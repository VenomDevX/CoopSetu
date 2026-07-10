import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateComment, deleteComment } from '@/services/comment.service';

const updateBodySchema = z.object({ body: z.string().min(1).max(10000) }).strict();

/** Edit own comment. Requires `comment:update_own`; ownership re-checked in service + RLS. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string; commentId: string }> },
) {
  return handle(async () => {
    const { commentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'comment:update_own');
    const { body } = updateBodySchema.parse(await req.json());
    return ok(await updateComment(supabase, m.organizationId, commentId, m.memberId, body));
  });
}

/** Soft-delete own comment. Requires `comment:delete_own`; ownership re-checked in service + RLS. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ taskId: string; commentId: string }> },
) {
  return handle(async () => {
    const { commentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'comment:delete_own');
    return ok(await deleteComment(supabase, m.organizationId, commentId, m.memberId));
  });
}
