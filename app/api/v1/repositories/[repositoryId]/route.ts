import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { deleteRepository } from '@/services/integration.service';

export async function DELETE(_req: Request, { params }: { params: Promise<{ repositoryId: string }> }) {
  return handle(async () => {
    const { repositoryId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'integration:manage');
    return ok(await deleteRepository(supabase, m.organizationId, repositoryId));
  });
}
