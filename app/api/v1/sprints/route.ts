import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createSprintSchema } from '@/lib/validation/delivery';
import { listSprints, createSprint } from '@/services/sprint.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'sprint:view');
    const projectId = new URL(req.url).searchParams.get('projectId') ?? undefined;
    return ok(await listSprints(supabase, m.organizationId, projectId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'sprint:create');
    const body = createSprintSchema.parse(await req.json());
    return ok(await createSprint(supabase, m.organizationId, body), undefined, 201);
  });
}
