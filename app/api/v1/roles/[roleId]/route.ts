import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateRolePermissions } from '@/services/role.service';

const schema = z.object({ permissions: z.array(z.string()).max(100) }).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  return handle(async () => {
    const { roleId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'member:manage');
    const body = schema.parse(await req.json());
    return ok(await updateRolePermissions(supabase, m.organizationId, roleId, body.permissions));
  });
}
