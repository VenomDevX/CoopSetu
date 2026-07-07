import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentChoiceClient from './client';

export default async function OnboardingStudentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <StudentChoiceClient />;
}
