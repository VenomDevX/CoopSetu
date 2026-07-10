import { handle, ok } from '@/lib/api/response';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { updateNotification } from '@/services/notification.service';

const patchSchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional(),
  snoozed_until: z.string().datetime().nullable().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  return handle(async () => {
    const { notificationId } = await params;
    const { supabase } = await requireUser();
    await requireOrganization();
    const body = patchSchema.parse(await req.json());
    return ok(await updateNotification(supabase, notificationId, body));
  });
}
