import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { decideReleaseApprovalSchema } from '@/lib/validation/delivery';
import { decideReleaseApproval } from '@/services/release.service';

export async function POST(req: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  return handle(async () => {
    const { releaseId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'approval:decide');
    const body = decideReleaseApprovalSchema.parse(await req.json());
    return ok(await decideReleaseApproval(supabase, m.organizationId, m.memberId, releaseId, body));
  });
}
