import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLegalStatus } from '@/lib/legal/get-legal-status';

export default async function OnboardingIndex({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. No auth
  if (!user) {
    redirect('/login');
  }

  // 2. Legal acceptance is now handled inline on the profile page.
  //    OAuth users who haven't accepted yet will see the checkbox there.

  // 3. Valid signed return-to invite destination
  const cookieStore = await cookies();
  const inviteReturnTo = cookieStore.get('invite_return_to')?.value;
  
  if (inviteReturnTo && /^\/invite\/[a-zA-Z0-9-]+$/.test(inviteReturnTo)) {
    // We cannot easily delete cookies in a Server Component page directly before redirecting,
    // so we will append a query param that signals the target page to clear it, 
    // or just let it expire (short-lived 10m).
    // Let's redirect to it.
    redirect(inviteReturnTo);
  }

  const admin = createAdminClient();

  // Fetch Profile (now includes profile_completed_at)
  const { data: profile } = await admin
    .from('profiles')
    .select('profile_completed_at')
    .eq('id', user.id)
    .single();

  // Fetch Memberships & Organizations
  const { data: memberships, error: membershipsError } = await admin
    .from('organization_members')
    .select(`
      is_active,
      organization_id,
      member_roles!member_roles_organization_member_id_fkey ( roles ( code ) ),
      organizations:organization_id ( initial_setup_completed_at )
    `)
    .eq('user_id', user.id);

  if (membershipsError) {
    throw new Error(`Failed to load memberships: ${membershipsError.message}`);
  }

  const activeMemberships = memberships?.filter(m => m.is_active) || [];
  
  // To verify pending invitations, we should query organization_invites by verified email
  const { data: pendingInvites } = await admin
    .from('organization_invites')
    .select('id')
    .eq('email', user.email)
    .eq('status', 'PENDING');

  const hasPendingInvites = (pendingInvites && pendingInvites.length > 0);

  // 4. Profile incomplete
  if (!profile?.profile_completed_at) {
    redirect('/onboarding/profile');
  }

  const createWorkspaceIntent = cookieStore.get('create_workspace_intent')?.value === 'true';

  // 5. Verified pending invitations and no active organization and NO create intent
  if (activeMemberships.length === 0 && hasPendingInvites && !createWorkspaceIntent) {
    redirect('/onboarding/invites');
  }

  // 6. No membership: route by work-vs-study intent (set by /onboarding/workspace-path).
  // Choosing student grants no permission by itself — it's only onboarding intent.
  if (activeMemberships.length === 0) {
    const workspacePathIntent = cookieStore.get('workspace_path_intent')?.value;
    if (workspacePathIntent === 'student') {
      redirect('/onboarding/student');
    } else if (workspacePathIntent === 'enterprise') {
      redirect('/onboarding/company');
    } else {
      redirect('/onboarding/workspace-path');
    }
  }

  // 7. New Organization Owner with initial workspace setup unfinished
  // Check if they are an owner of an org with initial_setup_completed_at IS NULL
  const unfinishedOwnedOrg = activeMemberships.find(m => {
    // @ts-ignore - Supabase join typing
    const roleCodes: string[] = (m.member_roles || []).map(mr => mr.roles?.code).filter(Boolean);
    // @ts-ignore - Supabase join typing
    return roleCodes.includes('ORG_OWNER') && !m.organizations?.initial_setup_completed_at;
  });

  if (unfinishedOwnedOrg) {
    redirect('/onboarding/team');
  }

  // 8. Completed membership/onboarding
  redirect(safeNext || '/dashboard');
}
