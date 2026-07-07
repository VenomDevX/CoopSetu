import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TeamCreationClient from './client';

export default async function OnboardingStudentTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <TeamCreationClient />;
}
