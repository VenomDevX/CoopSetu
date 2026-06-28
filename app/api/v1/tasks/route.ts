import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createTaskSchema } from '@/lib/validation/task';
import { listTasks, createTask } from '@/services/task.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:view');
    const sp = new URL(req.url).searchParams;
    const tasks = await listTasks(supabase, m.organizationId, {
      projectId: sp.get('projectId') ?? undefined,
      status: sp.get('status') ?? undefined,
      sprintId: sp.get('sprintId') ?? undefined,
      assigneeMemberId: sp.get('assigneeMemberId') ?? undefined,
      mine: sp.get('mine') === 'true',
    }, m.memberId);
    return ok(tasks);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:create');
    const body = createTaskSchema.parse(await req.json());
    // Assigning at create time additionally requires assignment authority.
    if (body.primary_assignee_member_id) requirePermission(m, 'task:assign');
    return ok(await createTask(supabase, m.organizationId, m.memberId, body), undefined, 201);
  });
}
