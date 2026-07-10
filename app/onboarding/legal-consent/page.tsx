import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLegalStatus } from '@/lib/legal/get-legal-status';
import LegalConsentClient from './client';

export default async function LegalConsentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Demo/anonymous visitors never see this gate.
  if (user.is_anonymous) {
    redirect('/onboarding');
  }

  const status = await getLegalStatus(user, supabase);
  if (status.isAccepted) {
    redirect('/onboarding');
  }

  // Display-only: derive the connected provider from the user's own verified
  // identities. Never expose provider tokens or other users' data.
  const identities = user.identities || [];
  const githubIdentity = identities.find((id) => id.provider === 'github');
  const googleIdentity = identities.find((id) => id.provider === 'google');

  let connectedProvider: 'GITHUB' | 'GOOGLE' | null = null;
  let connectedLabel = '';
  if (githubIdentity) {
    const githubUsername = githubIdentity.identity_data?.preferred_username || githubIdentity.identity_data?.user_name;
    connectedProvider = 'GITHUB';
    connectedLabel = `@${githubUsername || user.email}`;
  } else if (googleIdentity) {
    connectedProvider = 'GOOGLE';
    connectedLabel = user.email || '';
  }

  return (
    <LegalConsentClient
      termsVersion={status.termsVersion}
      privacyVersion={status.privacyVersion}
      connectedProvider={connectedProvider}
      connectedLabel={connectedLabel}
    />
  );
}
