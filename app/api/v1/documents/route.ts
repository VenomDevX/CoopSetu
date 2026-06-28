import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listDocuments, createDocument } from '@/services/document.service';

const schema = z.object({
  title: z.string().min(1).max(200),
  content_markdown: z.string().max(200000).optional(),
  document_type: z.string().max(40).optional(),
  project_id: z.string().uuid().optional(),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'document:view');
    const projectId = new URL(req.url).searchParams.get('projectId') ?? undefined;
    return ok(await listDocuments(supabase, m.organizationId, projectId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'document:create');
    const body = schema.parse(await req.json());
    return ok(await createDocument(supabase, m.organizationId, m.memberId, body), undefined, 201);
  });
}
