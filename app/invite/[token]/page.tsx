import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import InviteClient from './client';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  // Clear the return-to cookie if it exists (consumed)
  const cookieStore = await cookies();
  if (cookieStore.has('invite_return_to')) {
    cookieStore.set('invite_return_to', '', { maxAge: 0 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If unauthenticated, middleware should have caught this and redirected.
  // But just in case:
  if (!user) {
    redirect(`/login?next=/invite/${token}`);
  }

  // Pre-fetch invite to check if it's valid for this user
  const admin = createAdminClient();
  const { data: invite, error } = await admin.rpc('get_invite', { p_token: token });
  
  const inviteData = Array.isArray(invite) ? invite[0] : invite;

  // We can pass the invite data to the client component to render
  return <InviteClient token={token} initialData={inviteData} error={error?.message} currentUserEmail={user.email} />;
}
