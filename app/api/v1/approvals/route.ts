import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createApprovalRequestSchema } from '@/lib/validation/delivery';
import { listApprovals, createApprovalRequest } from '@/services/approval.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'approval:view');
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    return ok(await listApprovals(supabase, m.organizationId, status));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'approval:create');
    const body = createApprovalRequestSchema.parse(await req.json());
    return ok(await createApprovalRequest(supabase, m.organizationId, m.memberId, body), undefined, 201);
  });
}
