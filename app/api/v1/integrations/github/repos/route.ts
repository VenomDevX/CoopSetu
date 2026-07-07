import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listOrgGithubRepos } from '@/services/integration.service';

/** Lists the connected org's real GitHub repos (for the import picker). */
export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'integration:view');
    return ok(await listOrgGithubRepos(supabase, m.organizationId));
  });
}
