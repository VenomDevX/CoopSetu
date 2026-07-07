import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import JoinTeamClient from './client';

export default async function JoinTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/join-team');

  return <JoinTeamClient />;
}
