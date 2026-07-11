import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import InviteClient from './client';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLegalStatus } from '@/lib/legal/get-legal-status';

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If unauthenticated, middleware should have caught this and redirected.
  // But just in case:
  if (!user) {
    redirect(`/login?next=/invite/${token}`);
  }

  // Legal acceptance is required before invite acceptance can create a
  // membership. Preserve the return route via the same cookie the
  // unauthenticated-navigation path uses, then bounce through the gate.
  if (!user.is_anonymous) {
    const status = await getLegalStatus(user, supabase);
    if (!status.isAccepted) {
      const cookieStore = await cookies();
      cookieStore.set('invite_return_to', `/invite/${token}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10,
        path: '/',
      });
      redirect('/onboarding');
    }
  }

  // Clear the return-to cookie now that it's been consumed.
  const cookieStore = await cookies();
  if (cookieStore.has('invite_return_to')) {
    cookieStore.set('invite_return_to', '', { maxAge: 0 });
  }

  // Pre-fetch invite to check if it's valid for this user
  const admin = createAdminClient();
  const { data: invite, error } = await admin.rpc('get_invite', { p_token: token });
  
  const inviteData = Array.isArray(invite) ? invite[0] : invite;

  // We can pass the invite data to the client component to render
  return <InviteClient token={token} initialData={inviteData} error={error?.message} currentUserEmail={user.email} />;
}
