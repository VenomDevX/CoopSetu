import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { Errors } from '@/lib/api/errors';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  filters: z.any().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'report:create');

    const body = await req.json();
    const data = createSchema.parse(body);

    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        organization_id: m.organizationId,
        created_by_member_id: m.memberId,
        name: data.name,
        type: data.type,
        filters: data.filters ?? {},
      })
      .select('id, name')
      .single();

    if (error) throw Errors.internal(error.message);

    return ok(report);
  });
}

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'report:view');

    const { data, error } = await supabase
      .from('reports')
      .select('id, name, type, created_at, report_schedules(id, cron_expression)')
      .eq('organization_id', m.organizationId)
      .order('created_at', { ascending: false });

    if (error) throw Errors.internal(error.message);

    return ok(data);
  });
}
