import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createMilestoneSchema } from '@/lib/validation/project';
import { createMilestone } from '@/services/project.service';

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return handle(async () => {
    const { projectId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:update');
    const body = createMilestoneSchema.parse(await req.json());
    return ok(await createMilestone(supabase, m.organizationId, projectId, body), undefined, 201);
  });
}
