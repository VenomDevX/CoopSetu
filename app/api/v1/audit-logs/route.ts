import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'audit:view');
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, resource_type, created_at, ip_address, actor:actor_member_id(user_id)')
      .eq('organization_id', m.organizationId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return ok([]);
    return ok(data);
  });
}
