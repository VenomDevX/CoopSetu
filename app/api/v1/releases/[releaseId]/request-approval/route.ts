import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { requestApproval } from '@/services/release.service';

export async function POST(_req: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  return handle(async () => {
    const { releaseId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'release:create');
    return ok(await requestApproval(supabase, m.organizationId, releaseId));
  });
}
