import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listProjectActivity } from '@/services/project.service';

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return handle(async () => {
    const { projectId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'project:view');
    return ok(await listProjectActivity(supabase, projectId));
  });
}
