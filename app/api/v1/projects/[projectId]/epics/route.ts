import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { listProjectEpics } from '@/services/project.service';

/**
 * Epics belonging to a project — used to populate the Create-Task epic picker.
 * Visibility is enforced by RLS (`epics_select` → can_view_project); the route
 * only requires an authenticated org member.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const { projectId } = await params;
    const { supabase } = await requireUser();
    await requireOrganization();
    return ok(await listProjectEpics(supabase, projectId));
  });
}
