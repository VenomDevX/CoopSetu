import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { getDocument, updateDocument } from '@/services/document.service';

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  content_markdown: z.string().max(200000).optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED']).optional(),
  change_summary: z.string().max(500).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  return handle(async () => {
    const { documentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'document:view');
    return ok(await getDocument(supabase, documentId));
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  return handle(async () => {
    const { documentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'document:update');
    const body = schema.parse(await req.json());
    return ok(await updateDocument(supabase, m.organizationId, m.memberId, documentId, body));
  });
}
