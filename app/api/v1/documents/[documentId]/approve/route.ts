import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { approveDocument } from '@/services/document.service';

export async function POST(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  return handle(async () => {
    const { documentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'document:approve');
    return ok(await approveDocument(supabase, m.organizationId, m.memberId, documentId));
  });
}
