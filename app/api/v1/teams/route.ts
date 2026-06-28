import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createTeamSchema } from '@/lib/validation/team';
import { listTeams, createTeam } from '@/services/team.service';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'team:view');
    return ok(await listTeams(supabase, m.organizationId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'team:create');
    const body = createTeamSchema.parse(await req.json());
    return ok(await createTeam(supabase, m.organizationId, body), undefined, 201);
  });
}
