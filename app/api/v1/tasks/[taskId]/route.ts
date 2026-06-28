import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateTaskSchema } from '@/lib/validation/task';
import { getTask, updateTask, archiveTask } from '@/services/task.service';

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
    if (body.primary_assignee_member_id) requirePermission(m, 'task:assign');
    return ok(await updateTask(supabase, m.organizationId, taskId, body));
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
