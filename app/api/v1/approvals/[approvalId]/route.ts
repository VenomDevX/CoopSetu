import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { decideApprovalSchema } from '@/lib/validation/delivery';
import { decideApproval } from '@/services/approval.service';

export async function PATCH(req: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  return handle(async () => {
    const { approvalId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'approval:decide');
    const body = decideApprovalSchema.parse(await req.json());
    return ok(await decideApproval(supabase, m.organizationId, m.memberId, approvalId, body));
  });
}
