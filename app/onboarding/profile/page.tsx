import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLegalStatus } from '@/lib/legal/get-legal-status';
import ProfileClient from './client';

export default async function OnboardingProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let needsLegalConsent = false;
  if (!user.is_anonymous) {
    const status = await getLegalStatus(user, supabase);
    needsLegalConsent = !status.isAccepted;
  }

  // Check if they are already complete?
  // We can just rely on the central resolver for strict checking,
  // but let's fetch their current profile to prefill the form.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, username, job_title')
    .eq('id', user.id)
    .single();

  // Find if they connected via GitHub
  const identities = user.identities || [];
  const githubIdentity = identities.find(id => id.provider === 'github');
  const githubUsername = githubIdentity?.identity_data?.preferred_username || githubIdentity?.identity_data?.user_name;

  const connectedAccount = githubIdentity
    ? { provider: 'github' as const, label: `@${githubUsername || user.email}` }
    : undefined;

  // If we have a verified github identity, prefill their exact GitHub name/username
  // (still editable) rather than making them re-type what GitHub already told us.
  let defaultFullName = profile?.full_name || '';
  if (!defaultFullName && githubIdentity?.identity_data?.name) {
    defaultFullName = githubIdentity.identity_data.name;
  }

  let defaultUsername = profile?.username || '';
  if (!defaultUsername && githubUsername) {
    defaultUsername = githubUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  }

  return (
    <ProfileClient
      initialFullName={defaultFullName}
      initialUsername={defaultUsername}
      connectedAccount={connectedAccount}
      needsLegalConsent={needsLegalConsent}
    />
  );
}

