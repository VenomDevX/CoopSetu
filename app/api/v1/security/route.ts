import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listSecurityReviews, listFindings, listComplianceControls } from '@/services/security.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'security:view');
    const projectId = new URL(req.url).searchParams.get('projectId') ?? undefined;
    const [reviews, findings, compliance] = await Promise.all([
      listSecurityReviews(supabase, m.organizationId, projectId),
      listFindings(supabase, m.organizationId, projectId),
      listComplianceControls(supabase, m.organizationId),
    ]);
    return ok({ reviews, findings, compliance });
  });
}
