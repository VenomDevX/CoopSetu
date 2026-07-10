import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { Errors } from '@/lib/api/errors';
import { z } from 'zod';

const scheduleSchema = z.object({
  cron_expression: z.string().min(1),
  recipients: z.array(z.string().email()),
}).strict();

// A trivial parser just for demonstration: 
// Treat everything as running 1 day from now to mock the calculation
function computeNextRun() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'report:schedule');

    const { reportId } = await params;
    
    // Validate report belongs to org
    const { data: report, error: repErr } = await supabase
      .from('reports')
      .select('id')
      .eq('id', reportId)
      .eq('organization_id', m.organizationId)
      .maybeSingle();

    if (repErr) throw Errors.internal(repErr.message);
    if (!report) throw Errors.notFound('Report not found');

    const body = await req.json();
    const data = scheduleSchema.parse(body);

    const { data: schedule, error } = await supabase
      .from('report_schedules')
      .insert({
        report_id: reportId,
        cron_expression: data.cron_expression,
        recipients: data.recipients,
        next_run_at: computeNextRun(),
      })
      .select('id')
      .single();

    if (error) throw Errors.internal(error.message);

    return ok(schedule);
  });
}
