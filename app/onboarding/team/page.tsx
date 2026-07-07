import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TeamClient from './client';

export default async function OnboardingTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Find if they connected via GitHub
  const identities = user.identities || [];
  const githubIdentity = identities.find(id => id.provider === 'github');

  const connectedAccount = githubIdentity 
    ? { provider: 'github' as const, label: `@${githubIdentity.identity_data?.preferred_username || githubIdentity.identity_data?.user_name || user.email}` }
    : undefined;

  return <TeamClient connectedAccount={connectedAccount} />;
}
