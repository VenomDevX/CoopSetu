import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import {
  listRepositories, listPullRequests, listCommits, listPipelines,
  listEnvironments, listDeployments,
} from '@/services/integration.service';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'integration:view');
    const [repositories, pullRequests, commits, pipelines, environments, deployments] = await Promise.all([
      listRepositories(supabase, m.organizationId),
      listPullRequests(supabase, m.organizationId),
      listCommits(supabase, m.organizationId),
      listPipelines(supabase, m.organizationId),
      listEnvironments(supabase, m.organizationId),
      listDeployments(supabase, m.organizationId),
    ]);
    return ok({ repositories, pullRequests, commits, pipelines, environments, deployments });
  });
}
