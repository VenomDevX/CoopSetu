import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { markAllRead } from '@/services/notification.service';

export async function POST() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    return ok(await markAllRead(supabase, m.memberId));
  });
}
