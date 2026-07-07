import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateMemberRoleSchema } from '@/lib/validation/student-team';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { notifyStudentTeamEvent } from '@/services/student-workspace.service';

/** PATCH a student team member's authority role. Leadership changes must go
 * through the dedicated transfer-leadership endpoint, never here. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const { id, memberId } = await params;
    const { supabase } = await requireUser();
    const membership = await requireOrganization(id);
    requirePermission(membership, 'student_team:assign_authority_role');

    const { roleCode } = updateMemberRoleSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: target } = await admin
      .from('organization_members')
      .select('id')
      .eq('id', memberId)
      .eq('organization_id', id)
      .maybeSingle();
    if (!target) throw Errors.notFound('Member not found in this team.');

    const { data: assignableRoles } = await admin
      .from('roles')
      .select('id, code')
      .in('code', ['STUDENT_CO_LEAD', 'STUDENT_MEMBER'])
      .is('organization_id', null);

    const roleRow = assignableRoles?.find((r) => r.code === roleCode);
    if (!roleRow) throw Errors.internal('Role not found.');

    await admin
      .from('member_roles')
      .delete()
      .eq('organization_member_id', memberId)
      .in('role_id', assignableRoles!.map((r) => r.id));

    await admin.from('member_roles').insert({ organization_member_id: memberId, role_id: roleRow.id });

    await createAuditLog(supabase, {
      organizationId: id,
      action: 'student_team.member_role_updated',
      entityType: 'organization_member',
      entityId: memberId,
      afterState: { roleCode },
    });

    await notifyStudentTeamEvent(
      supabase, id, [memberId], 'STUDENT_TEAM_ROLE_CHANGED',
      'Your team role has changed', `Your role is now ${roleCode.replace('STUDENT_', '').replace('_', ' ')}.`,
    ).catch(() => {});

    return ok({ memberId, roleCode });
  });
}
