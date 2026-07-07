import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { coLeadToggleSchema } from '@/lib/validation/student-team';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';

/** Team Lead only: enable/disable whether Co-Leads may manage team members.
 * Disabling immediately revokes that ability (enforced by every member-
 * management endpoint re-reading this flag, not just cached client state). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { supabase } = await requireUser();
    const membership = await requireOrganization(id);
    requirePermission(membership, 'student_team:manage_settings');

    const { enabled } = coLeadToggleSchema.parse(await req.json());
    const admin = createAdminClient();

    const { error } = await admin
      .from('student_team_settings')
      .update({ co_lead_can_manage_members: enabled })
      .eq('organization_id', id);
    if (error) throw Errors.internal('Failed to update team settings.');

    await createAuditLog(supabase, {
      organizationId: id,
      action: enabled ? 'student_team.co_lead_management_enabled' : 'student_team.co_lead_management_disabled',
      entityType: 'organization',
      entityId: id,
      afterState: { co_lead_can_manage_members: enabled },
    });

    return ok({ co_lead_can_manage_members: enabled });
  });
}
