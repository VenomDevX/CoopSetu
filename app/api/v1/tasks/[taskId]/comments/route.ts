import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createCommentSchema } from '@/lib/validation/comment';
import { listComments, createComment } from '@/services/comment.service';

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:view');
    return ok(await listComments(supabase, taskId));
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'comment:create');
    const body = createCommentSchema.parse(await req.json());
    return ok(await createComment(supabase, m.organizationId, taskId, m.memberId, body), undefined, 201);
  });
}
