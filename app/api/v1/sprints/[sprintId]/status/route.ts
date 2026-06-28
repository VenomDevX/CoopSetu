import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { setSprintStatus } from '@/services/sprint.service';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED']),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ sprintId: string }> }) {
  return handle(async () => {
    const { sprintId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'sprint:update');
    
    const body = schema.parse(await req.json());
    return ok(await setSprintStatus(supabase, m.organizationId, sprintId, body.status));
  });
}
