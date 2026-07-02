import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/send-email';

/**
 * Best-effort email notification for a single member. Looks up their profile
 * email and sends fire-and-forget — failures are logged, never thrown, so a
 * broken/unreachable SMTP server never breaks the calling request.
 */
export async function notifyMemberByEmail(
  supabase: SupabaseClient,
  memberId: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    const { data: member } = await supabase
      .from('organization_members')
      .select('profile:profiles!org_members_profile_fk(email)')
      .eq('id', memberId)
      .maybeSingle();
    const profile = Array.isArray(member?.profile) ? member?.profile[0] : member?.profile;
    const email = profile?.email;
    if (!email) return;
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    console.error('[notify] failed to send email', err);
  }
}
