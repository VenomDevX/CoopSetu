import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { addTimelineEvent } from '@/services/incident.service';

const schema = z.object({ message: z.string().min(1).max(2000), event_type: z.string().max(40).optional() }).strict();

export async function POST(req: Request, { params }: { params: Promise<{ incidentId: string }> }) {
  return handle(async () => {
    const { incidentId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    const body = schema.parse(await req.json());
    return ok(await addTimelineEvent(supabase, incidentId, m.memberId, body.message, body.event_type), undefined, 201);
  });
}
