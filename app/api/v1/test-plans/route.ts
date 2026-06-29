import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requireAnyPermission } from '@/lib/auth/require-organization';
import { createTestPlanSchema } from '@/lib/validation/qa-security';
import { createTestPlan } from '@/services/test-plan.service';

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requireAnyPermission(m, ['test_plan:create', 'qa:create']);
    const body = createTestPlanSchema.parse(await req.json());
    return ok(await createTestPlan(supabase, m.organizationId, m.memberId, body), undefined, 201);
  });
}
