import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateTaskSchema } from '@/lib/validation/task';
import { getTask, updateTask, archiveTask } from '@/services/task.service';

const BROAD_VISIBILITY_SCOPES = new Set(['PROJECT_SHARED', 'ORGANIZATION_VISIBLE']);
const PRIVILEGED_ROLES_FOR_VISIBILITY = ['ORG_OWNER', 'ORG_ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER'];

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:view');
    return ok(await getTask(supabase, taskId));
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:update');
    const body = updateTaskSchema.parse(await req.json());
    // Reassigning the primary assignee requires assignment authority.
    if (Object.prototype.hasOwnProperty.call(body, 'primary_assignee_member_id')) {
      requirePermission(m, 'task:assign');
    }
    // Broadening visibility to PROJECT_SHARED or ORGANIZATION_VISIBLE requires
    // admin/owner or project-manager authority. RLS enforces this too, but we
    // surface a clear error here before the DB round-trip.
    if (body.visibility_scope && BROAD_VISIBILITY_SCOPES.has(body.visibility_scope)) {
      if (!m.roles.some((r) => PRIVILEGED_ROLES_FOR_VISIBILITY.includes(r))) {
        throw Errors.forbidden('Only administrators and project managers may set broader task visibility.');
      }
    }
    return ok(await updateTask(supabase, m.organizationId, taskId, body, m.memberId));
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:delete');
    return ok(await archiveTask(supabase, m.organizationId, taskId, m.memberId));
  });
}
