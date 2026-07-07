import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { importGithubRepositorySchema } from '@/lib/validation/integration';
import { importGithubRepository } from '@/services/integration.service';

/** Imports a real GitHub repo the caller picked from GET /integrations/github/repos. */
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'integration:manage');
    const body = importGithubRepositorySchema.parse(await req.json());
    return ok(await importGithubRepository(supabase, m.organizationId, body), undefined, 201);
  });
}
