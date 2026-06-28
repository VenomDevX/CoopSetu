import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateProjectSchema } from '@/lib/validation/project';
import { getProject, updateProject } from '@/services/project.service';

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return handle(async () => {
    const { projectId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:view');
    return ok(await getProject(supabase, projectId));
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return handle(async () => {
    const { projectId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:update');
    const body = updateProjectSchema.parse(await req.json());
    return ok(await updateProject(supabase, m.organizationId, projectId, body));
  });
}
