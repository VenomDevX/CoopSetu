import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateSprintSchema } from '@/lib/validation/delivery';
import { updateSprint, getBurndown } from '@/services/sprint.service';
import { listTasks } from '@/services/task.service';

export async function GET(req: Request, { params }: { params: Promise<{ sprintId: string }> }) {
  return handle(async () => {
    const { sprintId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'sprint:view');
    
    const burndown = await getBurndown(supabase, sprintId);
    const tasks = await listTasks(supabase, m.organizationId, { sprintId }, m.memberId);
    
    return ok({ ...burndown, tasks });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sprintId: string }> }) {
  return handle(async () => {
    const { sprintId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'sprint:update');
    const body = updateSprintSchema.parse(await req.json());
    return ok(await updateSprint(supabase, m.organizationId, sprintId, body));
  });
}
