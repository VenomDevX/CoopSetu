import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listMembers, getMemberAggregates } from '@/services/member.service';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'member:view');
    const members = await listMembers(supabase, m.organizationId);
    const aggregates = await getMemberAggregates(supabase, members.map((r: any) => r.id));
    return ok(members.map((r: any) => ({ ...r, ...aggregates[r.id] })));
  });
}
