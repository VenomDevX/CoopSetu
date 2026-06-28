import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createReleaseSchema } from '@/lib/validation/delivery';
import { listReleases, createRelease } from '@/services/release.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'release:view');
    const projectId = new URL(req.url).searchParams.get('projectId') ?? undefined;
    return ok(await listReleases(supabase, m.organizationId, projectId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'release:create');
    const body = createReleaseSchema.parse(await req.json());
    return ok(await createRelease(supabase, m.organizationId, body), undefined, 201);
  });
}
