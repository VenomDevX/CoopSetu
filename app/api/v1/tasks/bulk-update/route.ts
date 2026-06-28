import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { bulkUpdateSchema } from '@/lib/validation/task';
import { bulkUpdateTasks } from '@/services/task.service';

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:bulk_update');
    const body = bulkUpdateSchema.parse(await req.json());
    return ok(await bulkUpdateTasks(supabase, m.organizationId, body.task_ids, body.patch));
  });
}
