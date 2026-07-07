import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import WorkspacePathClient from './client';

export default async function WorkspacePathPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <WorkspacePathClient />;
}
