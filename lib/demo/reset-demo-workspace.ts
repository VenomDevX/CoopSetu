import { createAdminClient } from '@/lib/supabase/admin';
import { provisionDemoWorkspace } from './provision-demo-workspace';

export async function resetDemoWorkspace(authUserId: string) {
  const admin = createAdminClient();

  // 1. Get current demo session
  const { data: session, error: sessionError } = await admin
    .from('demo_sessions')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (sessionError || !session) {
    throw new Error('No active demo session found to reset.');
  }

  // 2. Delete the organization
  // Because of ON DELETE CASCADE, this will also delete:
  // - public.demo_sessions
  // - public.organization_members
  // - public.projects, tasks, teams, etc.
  const { error: deleteError } = await admin
    .from('organizations')
    .delete()
    .eq('id', session.organization_id);

  if (deleteError) {
    throw new Error(`Failed to reset demo workspace: ${deleteError.message}`);
  }

  // 3. Re-provision with the same auth user and the preserved role
  return await provisionDemoWorkspace(authUserId, session.active_demo_role);
}
