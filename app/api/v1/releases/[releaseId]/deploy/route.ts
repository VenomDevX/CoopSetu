import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { deployReleaseSchema } from '@/lib/validation/delivery';
import { deployRelease } from '@/services/release.service';

export async function POST(req: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  return handle(async () => {
    const { releaseId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'release:deploy');
    const body = deployReleaseSchema.parse(await req.json().catch(() => ({})));
    return ok(await deployRelease(supabase, m.organizationId, m.memberId, releaseId, body.environment_id));
  });
}
