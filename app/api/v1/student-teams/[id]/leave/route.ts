import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';

/** A current Team Lead must transfer leadership before they can leave. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { supabase } = await requireUser();
    const membership = await requireOrganization(id);

    if (membership.roles.includes('STUDENT_TEAM_LEAD')) {
      throw Errors.conflict('Transfer leadership to another member before leaving this team.');
    }

    const admin = createAdminClient();
    await admin.from('organization_members').update({ is_active: false }).eq('id', membership.memberId);

    await createAuditLog(supabase, {
      organizationId: id,
      action: 'student_team.member_left',
      entityType: 'organization_member',
      entityId: membership.memberId,
    });

    return ok({ left: true });
  });
}
