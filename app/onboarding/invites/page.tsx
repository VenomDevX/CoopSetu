import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import InvitesClient from './client';

export default async function OnboardingInvitesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect('/login');
  }

  const admin = createAdminClient();

  // Fetch pending invites for the user's verified email
  const { data: invites } = await admin
    .from('organization_invites')
    .select(`
      id,
      organization_id,
      role_code,
      organizations:organization_id ( name )
    `)
    .eq('email', user.email)
    .eq('status', 'PENDING')
    .gt('expires_at', new Date().toISOString());

  // If no invites, they shouldn't be on this page. Resolver should catch this, but just in case:
  if (!invites || invites.length === 0) {
    redirect('/onboarding');
  }

  // Format the invites for the client
  const pendingInvites = invites.map((inv: any) => ({
    id: inv.id,
    organizationName: inv.organizations?.name || 'Unknown Organization',
    roleCode: inv.role_code,
  }));

  return <InvitesClient pendingInvites={pendingInvites} />;
}
