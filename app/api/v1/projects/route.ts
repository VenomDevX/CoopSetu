import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createProjectSchema } from '@/lib/validation/project';
import { listProjects, createProject } from '@/services/project.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:view');
    const includeArchived = new URL(req.url).searchParams.get('archived') === 'true';
    return ok(await listProjects(supabase, m.organizationId, { includeArchived }));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:create');
    const body = createProjectSchema.parse(await req.json());
    return ok(await createProject(supabase, m.organizationId, body), undefined, 201);
  });
}
