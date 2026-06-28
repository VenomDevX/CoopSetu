import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { getBurndown } from '@/services/sprint.service';

export async function GET(_req: Request, { params }: { params: Promise<{ sprintId: string }> }) {
  return handle(async () => {
    const { sprintId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'sprint:view');
    return ok(await getBurndown(supabase, sprintId));
  });
}
