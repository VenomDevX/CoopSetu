import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isReservedUsername } from '@/lib/auth/reserved-identifiers';

const schema = z.object({
  // Any alphabet/script (Unicode letters + marks) — names aren't Latin-only.
  fullName: z.string().min(1).max(100).regex(/^[\p{L}\p{M}\s'.\-]+$/u),
  username: z.string().min(3).max(30).regex(/^[a-z0-9\._\-]+$/).refine(s => !s.includes(' ') && !s.includes('..')),
  jobFamily: z.string().min(1),
  jobTitle: z.string().min(2).max(80),
  managerType: z.string().optional(),
  specialization: z.string().min(2).max(100),
  professionalDescription: z.string().max(500).optional(),
  timezone: z.string().optional(),
}).strict();

export async function POST(req: NextRequest) {
  return handle(async () => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw Errors.unauthenticated('Not authenticated');
    }

    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const normalizedUsername = body.username.trim().toLowerCase();

    if (isReservedUsername(normalizedUsername)) {
      throw Errors.validation('Username is no longer available.');
    }

    // Check username availability and current avatar
    const { data: existingUser } = await admin
      .from('profiles')
      .select('id, avatar_path')
      .eq('username_normalized', normalizedUsername)
      .neq('id', user.id) // Exclude current user in case they are re-saving
      .maybeSingle();

    if (existingUser) {
      throw Errors.validation('Username is no longer available.');
    }

    // Get the current profile for the user
    const { data: currentUserProfile } = await admin
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .single();

    // Prefer existing avatar if set, otherwise try to pull from OAuth metadata (GitHub or Google)
    const avatarUrl = currentUserProfile?.avatar_path || user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    // Update the profile
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        full_name: body.fullName,
        username: body.username.trim(),
        username_normalized: normalizedUsername,
        job_title: body.jobTitle,
        timezone: body.timezone || 'UTC',
        avatar_path: avatarUrl,
        profile_completed_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      if (updateError.code === '23505') { // Unique violation
        throw Errors.validation('Username is no longer available.');
      }
      throw Errors.internal('Failed to update profile');
    }

    // Determine the next step dynamically to avoid Next.js redirect flashes
    let nextUrl = '/dashboard';
    const { data: pendingInvites } = await admin
      .from('organization_invites')
      .select('id')
      .eq('email', user.email)
      .eq('status', 'PENDING');
    const hasPendingInvites = (pendingInvites && pendingInvites.length > 0);

    const { data: memberships } = await admin
      .from('organization_members')
      .select(`is_active, organization_id, member_roles!member_roles_organization_member_id_fkey ( roles ( code ) ), organizations:organization_id ( initial_setup_completed_at )`)
      .eq('user_id', user.id);
    const activeMemberships = memberships?.filter(m => m.is_active) || [];

    const createWorkspaceIntent = req.cookies.get('create_workspace_intent')?.value === 'true';

    if (activeMemberships.length === 0 && hasPendingInvites && !createWorkspaceIntent) {
      nextUrl = '/onboarding/invites';
    } else if (activeMemberships.length === 0) {
      const workspacePathIntent = req.cookies.get('workspace_path_intent')?.value;
      if (workspacePathIntent === 'student') {
        nextUrl = '/onboarding/student';
      } else if (workspacePathIntent === 'enterprise') {
        nextUrl = '/onboarding/company';
      } else {
        nextUrl = '/onboarding/workspace-path';
      }
    } else {
      const unfinishedOwnedOrg = activeMemberships.find(m => {
        const roleCodes: string[] = (m.member_roles || []).map((mr: any) => mr.roles?.code).filter(Boolean);
        return roleCodes.includes('ORG_OWNER') && !m.organizations?.initial_setup_completed_at;
      });
      if (unfinishedOwnedOrg) {
        nextUrl = '/onboarding/team';
      }
    }

    return ok({ success: true, nextUrl });
  });
}
