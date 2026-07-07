import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { transferLeadershipSchema } from '@/lib/validation/student-team';
import { transferLeadership } from '@/services/student-workspace.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    const membership = await requireOrganization(id);
    requirePermission(membership, 'student_team:transfer_leadership');

    const { toMemberId, demoteTo } = transferLeadershipSchema.parse(await req.json());
    await transferLeadership(supabase, user.id, id, toMemberId, demoteTo);

    return ok({ transferred: true });
  });
}
