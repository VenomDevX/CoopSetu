import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { getIncident, updateIncident } from '@/services/incident.service';

const schema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED']).optional(),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']).optional(),
  summary: z.string().max(5000).optional(),
  root_cause: z.string().max(5000).optional(),
  customer_impact: z.string().max(2000).optional(),
}).strict();

export async function GET(_req: Request, { params }: { params: Promise<{ incidentId: string }> }) {
  return handle(async () => {
    const { incidentId } = await params;
    const { supabase } = await requireUser();
    await requireOrganization();
    return ok(await getIncident(supabase, incidentId));
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ incidentId: string }> }) {
  return handle(async () => {
    const { incidentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    const body = schema.parse(await req.json());
    return ok(await updateIncident(supabase, m.organizationId, incidentId, body));
  });
}
