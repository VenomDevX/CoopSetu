import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { requireLegalAccepted } from '@/lib/legal/require-legal-accepted';
import { createSoloWorkspaceSchema, updateSoloWorkspaceSchema, deleteSoloWorkspaceSchema } from '@/lib/validation/student-team';
import { createStudentSoloWorkspace } from '@/services/student-workspace.service';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user, supabase } = await requireUser();
    await requireLegalAccepted(user, supabase);
    const body = createSoloWorkspaceSchema.parse(await req.json());

    const org = await createStudentSoloWorkspace(supabase, user.id, body);

    const res = ok({ organizationId: org.id });
    res.cookies.set(ACTIVE_ORG_COOKIE, org.id, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  });
}

/** Rename / edit the description of a STUDENT_SOLO workspace. Uses the admin
 * client because organizations' RLS update policy only recognizes
 * organization:manage, not student_workspace:manage_settings — the app-layer
 * guards below are the real boundary here. */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const membership = await requireOrganization();
    if (membership.workspaceType !== 'STUDENT_SOLO') throw Errors.forbidden();
    requirePermission(membership, 'student_workspace:manage_settings');

    const body = updateSoloWorkspaceSchema.parse(await req.json());
    if (Object.keys(body).length === 0) throw Errors.validation('No fields to update.');

    const { data, error } = await createAdminClient()
      .from('organizations')
      .update(body)
      .eq('id', membership.organizationId)
      .select('*')
      .maybeSingle();
    if (error) throw Errors.internal(error.message);
    if (!data) throw Errors.notFound('Workspace not found.');

    await createAuditLog(supabase, {
      organizationId: membership.organizationId,
      action: 'organization.updated',
      entityType: 'organization',
      entityId: membership.organizationId,
      afterState: body,
    });

    return ok(data);
  });
}

/** Delete a STUDENT_SOLO workspace (not the account). Requires the caller to
 * type the workspace's exact current name, mirroring the account-deletion
 * confirmation UX in app/api/v1/profile/route.ts. */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const membership = await requireOrganization();
    if (membership.workspaceType !== 'STUDENT_SOLO') throw Errors.forbidden();
    requirePermission(membership, 'student_workspace:delete');

    const { confirmation } = deleteSoloWorkspaceSchema.parse(await req.json());
    const admin = createAdminClient();
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', membership.organizationId)
      .maybeSingle();
    if (!org) throw Errors.notFound('Workspace not found.');
    if (confirmation.trim() !== org.name) {
      throw Errors.validation('Confirmation text does not match the workspace name.');
    }

    await createAuditLog(supabase, {
      organizationId: membership.organizationId,
      action: 'student_workspace.deleted',
      entityType: 'organization',
      entityId: membership.organizationId,
      afterState: { name: org.name },
    });

    const { error } = await admin.from('organizations').delete().eq('id', membership.organizationId);
    if (error) throw Errors.internal('Failed to delete workspace.');

    const res = ok({ message: 'Workspace deleted.' });
    res.cookies.delete(ACTIVE_ORG_COOKIE);
    return res;
  });
}
