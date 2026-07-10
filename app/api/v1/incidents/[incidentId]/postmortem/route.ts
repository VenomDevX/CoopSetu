import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { upsertPostmortem } from '@/services/incident.service';

const schema = z.object({
  summary: z.string().max(10000).optional(),
  detection: z.string().max(5000).optional(),
  impact: z.string().max(5000).optional(),
  root_cause: z.string().max(5000).optional(),
  response: z.string().max(5000).optional(),
  resolution: z.string().max(5000).optional(),
  lessons_learned: z.string().max(5000).optional(),
  status: z.string().max(40).optional(),
}).strict();

export async function POST(req: Request, { params }: { params: Promise<{ incidentId: string }> }) {
  return handle(async () => {
    const { incidentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    const body = schema.parse(await req.json());
    return ok(await upsertPostmortem(supabase, incidentId, m.memberId, body), undefined, 201);
  });
}
