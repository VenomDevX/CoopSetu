import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { listIncidents, createIncident } from '@/services/incident.service';

const schema = z.object({
  title: z.string().min(1).max(200),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']).optional(),
  project_id: z.string().uuid().optional(),
  customer_impact: z.string().max(2000).optional(),
});

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    return ok(await listIncidents(supabase, m.organizationId));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'task:update');
    const body = schema.parse(await req.json());
    return ok(await createIncident(supabase, m.organizationId, m.memberId, body), undefined, 201);
  });
}
