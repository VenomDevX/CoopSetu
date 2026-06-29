import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requireAnyPermission } from '@/lib/auth/require-organization';
import { createSecurityReviewSchema } from '@/lib/validation/qa-security';
import { createSecurityReview } from '@/services/security-review.service';

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requireAnyPermission(m, ['security_review:create', 'security:create']);
    const body = createSecurityReviewSchema.parse(await req.json());
    return ok(await createSecurityReview(supabase, m.organizationId, m.memberId, body), undefined, 201);
  });
}
