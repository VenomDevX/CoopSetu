import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';

/* ── GET /api/v1/profile ─────────────────────────────────────── */
export async function GET() {
  return handle(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw Errors.unauthenticated();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, username, avatar_path')
    .eq('id', user.id)
    .single();

  return ok({
    id: user.id,
    email: user.email,
    fullName: profile?.full_name ?? '',
    username: profile?.username ?? '',
    avatarUrl: profile?.avatar_path ?? null,
  });
  });
}

/* ── PATCH /api/v1/profile ─── Update name/username ──────────── */
const updateSchema = z.object({
  // Any alphabet/script (Unicode letters + marks) — names aren't Latin-only.
  fullName: z.string().min(1, 'Name is required').max(100).regex(/^[\p{L}\p{M}\s'.\-]+$/u, 'Invalid characters in name').optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._\-]+$/, 'Invalid username format').optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  return handle(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw Errors.unauthenticated();

  const body = updateSchema.parse(await req.json());

  const updates: Record<string, string> = {};
  if (body.fullName) updates.full_name = body.fullName;
  if (body.username) {
    updates.username = body.username.trim();
    updates.username_normalized = body.username.trim().toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    throw Errors.validation('No fields to update.');
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    if (error.message?.includes('duplicate') || error.code === '23505') {
      throw Errors.validation('Username is already taken.');
    }
    throw Errors.internal('Failed to update profile.');
  }

  return ok({ message: 'Profile updated successfully.' });
  });
}

/* ── DELETE /api/v1/profile ─── Permanently delete the account ── */
const deleteSchema = z.object({
  confirmation: z.string().min(1, 'Confirmation is required'),
}).strict();

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw Errors.unauthenticated();

    const body = deleteSchema.parse(await req.json());
    if (body.confirmation.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
      throw Errors.validation('Confirmation text does not match your account email.');
    }

    const admin = createAdminClient();

    // Find every org this user is the ORG_OWNER of, and check for other active members.
    const { data: memberships, error: memErr } = await admin
      .from('organization_members')
      .select(`
        organization_id,
        member_roles!member_roles_organization_member_id_fkey ( roles ( code ) )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (memErr) throw Errors.internal('Failed to verify organization memberships.');

    const ownedOrgIds = (memberships || [])
      .filter((m) => {
        // @ts-ignore - Supabase join typing
        const codes: string[] = (m.member_roles || []).map((mr) => mr.roles?.code).filter(Boolean);
        return codes.includes('ORG_OWNER');
      })
      .map((m) => m.organization_id);

    const blockedOrgNames: string[] = [];
    const orgsToDelete: string[] = [];

    for (const orgId of ownedOrgIds) {
      const { count } = await admin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .neq('user_id', user.id);

      if ((count ?? 0) > 0) {
        const { data: org } = await admin.from('organizations').select('name').eq('id', orgId).single();
        blockedOrgNames.push(org?.name ?? orgId);
      } else {
        orgsToDelete.push(orgId);
      }
    }

    if (blockedOrgNames.length > 0) {
      throw Errors.validation(
        `You are the sole owner of ${blockedOrgNames.join(', ')}. Transfer ownership or remove all other members before deleting your account.`,
      );
    }

    await createAuditLog(supabase, {
      organizationId: null,
      action: 'account.deleted',
      entityType: 'user',
      entityId: user.id,
    });

    // Delete organizations the user solely owns and is the sole member of.
    // Their cascades clean up all dependent org-scoped data.
    if (orgsToDelete.length > 0) {
      const { error: delOrgErr } = await admin.from('organizations').delete().in('id', orgsToDelete);
      if (delOrgErr) throw Errors.internal('Failed to clean up owned organizations.');
    }

    // organizations.created_by has no cascade rule, so clear it for any org this
    // user created but no longer solely owns (ownership was transferred away).
    await admin.from('organizations').update({ created_by: null }).eq('created_by', user.id);

    // Best-effort avatar cleanup (profile row itself cascades from the user delete below).
    for (const ext of ['jpg', 'png', 'webp', 'gif', 'jpeg']) {
      await admin.storage.from('avatars').remove([`avatars/${user.id}.${ext}`]);
    }

    // Deletes auth.users, which cascades to profiles, organization_members,
    // identities, sessions, and every other user-scoped row via FK cascade.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw Errors.internal('Failed to delete account.');

    await supabase.auth.signOut();

    return ok({ message: 'Account deleted.' });
  });
}
