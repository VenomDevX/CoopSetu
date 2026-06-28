import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { addDocumentComment } from '@/services/document.service';

const schema = z.object({ body: z.string().min(1).max(10000) });

export async function POST(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  return handle(async () => {
    const { documentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'comment:create');
    const body = schema.parse(await req.json());
    return ok(await addDocumentComment(supabase, m.organizationId, m.memberId, documentId, body.body), undefined, 201);
  });
}
