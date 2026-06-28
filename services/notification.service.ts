import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import {
  categoryOf, NOTIFICATION_CATEGORIES, type NotificationCounts,
} from '@/lib/constants/notification-categories';

export async function listNotifications(
  supabase: SupabaseClient, memberId: string, opts?: { unreadOnly?: boolean },
) {
  // Snoozed notifications (snoozed_until in the future) are hidden from the
  // inbox until they resurface, so the Snooze action is actually functional.
  const now = new Date().toISOString();
  let q = supabase
    .from('notifications')
    .select('*, actor:actor_member_id(id, user_id)')
    .eq('recipient_member_id', memberId)
    .is('archived_at', null)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (opts?.unreadOnly) q = q.is('read_at', null);
  const { data, error } = await q;
  if (error) throw Errors.internal(error.message);

  // Category + ALL/UNREAD counts come from the SAME organization-scoped query
  // (recipient + not archived + not snoozed) so every badge agrees with the list.
  // We aggregate lightweight rows rather than firing one count query per category.
  const { data: countRows, error: cErr } = await supabase
    .from('notifications')
    .select('type, read_at')
    .eq('recipient_member_id', memberId)
    .is('archived_at', null)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .limit(2000);
  if (cErr) throw Errors.internal(cErr.message);

  const counts = { all: 0, unread: 0 } as NotificationCounts;
  for (const c of NOTIFICATION_CATEGORIES) counts[c.key] = 0;
  for (const row of countRows ?? []) {
    counts.all += 1;
    if (!row.read_at) counts.unread += 1;
    counts[categoryOf(row.type)] += 1;
  }

  return { items: data ?? [], unread: counts.unread, counts };
}

export async function updateNotification(
  supabase: SupabaseClient, notificationId: string,
  patch: { read?: boolean; archived?: boolean; snoozed_until?: string | null },
) {
  const update: Record<string, unknown> = {};
  if (patch.read !== undefined) update.read_at = patch.read ? new Date().toISOString() : null;
  if (patch.archived !== undefined) update.archived_at = patch.archived ? new Date().toISOString() : null;
  if (patch.snoozed_until !== undefined) update.snoozed_until = patch.snoozed_until;

  const { data, error } = await supabase
    .from('notifications').update(update).eq('id', notificationId).select('*').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Notification not found.');
  return data;
}

export async function markAllRead(supabase: SupabaseClient, memberId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_member_id', memberId)
    .is('read_at', null);
  if (error) throw Errors.internal(error.message);
  return { ok: true };
}
