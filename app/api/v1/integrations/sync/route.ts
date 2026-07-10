import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { mockSync, getRepositoryForSync, syncGithubRepository } from '@/services/integration.service';

const syncBodySchema = z.object({ repository_id: z.string().uuid() }).strict();

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'integration:manage');
    const { repository_id } = syncBodySchema.parse(await req.json());

    const repo = await getRepositoryForSync(supabase, m.organizationId, repository_id);
    if (repo.provider === 'github' && repo.integration_id) {
      return ok(await syncGithubRepository(supabase, m.organizationId, repo));
    }
    // Non-GitHub or manually-added repos have no real credentials to sync
    // against — preserve the existing mock behavior for those.
    return ok(await mockSync(supabase, m.organizationId, m.memberId));
  });
}
