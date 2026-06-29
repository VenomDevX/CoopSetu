import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requireAnyPermission } from '@/lib/auth/require-organization';
import { createBugSchema } from '@/lib/validation/qa-security';
import { createBug } from '@/services/bug.service';

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requireAnyPermission(m, ['bug:create', 'qa:create']);
    const body = createBugSchema.parse(await req.json());
    return ok(await createBug(supabase, m.organizationId, m.memberId, body), undefined, 201);
  });
}
