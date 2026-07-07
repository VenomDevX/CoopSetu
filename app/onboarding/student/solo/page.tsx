import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SoloWorkspaceClient from './client';

export default async function OnboardingStudentSoloPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'My';

  return <SoloWorkspaceClient defaultName={`${displayName}'s Workspace`} />;
}
