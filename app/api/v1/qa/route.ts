import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listBugs, listTestPlans } from '@/services/qa.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:view');
    const projectId = new URL(req.url).searchParams.get('projectId') ?? undefined;
    const [bugs, testPlans] = await Promise.all([
      listBugs(supabase, m.organizationId, projectId),
      listTestPlans(supabase, m.organizationId, projectId),
    ]);
    return ok({ bugs, testPlans });
  });
}
