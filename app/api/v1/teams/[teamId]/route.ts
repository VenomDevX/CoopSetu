import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateTeamSchema } from '@/lib/validation/team';
import { updateTeam } from '@/services/team.service';

export async function PATCH(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  return handle(async () => {
    const { teamId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'team:update');
    const body = updateTeamSchema.parse(await req.json());
    return ok(await updateTeam(supabase, m.organizationId, teamId, body));
  });
}
