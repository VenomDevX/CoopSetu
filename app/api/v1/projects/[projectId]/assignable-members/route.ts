import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { getAssignableMembers } from '@/services/member.service';
import { ADMIN_ROLES } from '@/lib/constants/roles';

/**
 * Eligible assignees for a task in this project. Visible to admins/owners and to
 * anyone who can create or assign tasks. The returned set is scoped to the
 * project's members and project-linked teams (see getAssignableMembers).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const { projectId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();

    const isAdmin = m.roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r));
    const canAssign =
      isAdmin || m.permissions.includes('task:create') || m.permissions.includes('task:assign');
    if (!canAssign) throw Errors.forbidden();

    return ok(await getAssignableMembers(supabase, m.organizationId, projectId));
  });
}
