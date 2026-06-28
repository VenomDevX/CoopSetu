import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { registerAttachment, listAttachments } from '@/services/attachment.service';

const schema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1).max(300),
  mime_type: z.string().max(200).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:view');
    return ok(await listAttachments(supabase, taskId));
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:update');
    const body = schema.parse(await req.json());
    const data = await registerAttachment(supabase, m.organizationId, m.memberId, { ...body, task_id: taskId });
    return ok(data, undefined, 201);
  });
}
