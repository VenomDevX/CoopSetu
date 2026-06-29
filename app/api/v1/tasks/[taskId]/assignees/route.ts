import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { addAssigneeSchema } from '@/lib/validation/task';
import { addAssignee } from '@/services/task.service';

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:assign');
    const body = addAssigneeSchema.parse(await req.json());
    return ok(
      await addAssignee(
        supabase,
        m.organizationId,
        taskId,
        body.organization_member_id,
        m.memberId,
        body.assignment_role,
        body.assignment_type,
      ),
      undefined,
      201,
    );
  });
}
