import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, hasPermission } from '@/lib/auth/require-organization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';

/** Remove a member from a student team. Team Lead can always do this;
 * a Co-Lead can only if the Lead has explicitly enabled
 * student_team_settings.co_lead_can_manage_members for this team. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const { id, memberId } = await params;
    const { supabase } = await requireUser();
    const membership = await requireOrganization(id);

    let allowed = hasPermission(membership, 'student_team:manage_members');
    if (!allowed && membership.roles.includes('STUDENT_CO_LEAD')) {
      const admin = createAdminClient();
      const { data: settings } = await admin
        .from('student_team_settings')
        .select('co_lead_can_manage_members')
        .eq('organization_id', id)
        .maybeSingle();
      allowed = !!settings?.co_lead_can_manage_members;
    }
    if (!allowed) throw Errors.forbidden();

    const admin = createAdminClient();
    const { data: target } = await admin
      .from('organization_members')
      .select('id')
      .eq('id', memberId)
      .eq('organization_id', id)
      .maybeSingle();
    if (!target) throw Errors.notFound('Member not found in this team.');

    // Leadership transfer/removal must go through the dedicated endpoint.
    const { data: targetRoles } = await admin
      .from('member_roles')
      .select('roles(code)')
      .eq('organization_member_id', memberId);
    // @ts-ignore - Supabase join typing
    const codes: string[] = (targetRoles ?? []).map((r) => r.roles?.code).filter(Boolean);
    if (codes.includes('STUDENT_TEAM_LEAD')) {
      throw Errors.conflict('Transfer leadership before removing the Team Lead.');
    }

    await admin.from('organization_members').update({ is_active: false }).eq('id', memberId);

    await createAuditLog(supabase, {
      organizationId: id,
      action: 'student_team.member_removed',
      entityType: 'organization_member',
      entityId: memberId,
    });

    return ok({ removed: true });
  });
}
