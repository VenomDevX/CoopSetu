import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { listNotifications } from '@/services/notification.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    const unreadOnly = new URL(req.url).searchParams.get('unread') === 'true';
    return ok(await listNotifications(supabase, m.memberId, { unreadOnly }));
  });
}
