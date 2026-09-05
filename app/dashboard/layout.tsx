import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { DashboardShell } from '@/components/dashboard/shell';
import { MobileDashboardShell } from '@/components/mobile/mobile-shell';
import { DemoBanner } from '@/components/demo/demo-banner';
import { getIsNative } from '@/lib/native/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const membership = await getCurrentMembership();
  if (!membership) redirect('/onboarding');



  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, avatar_path').eq('id', user.id).maybeSingle(),
    supabase.from('organizations').select('name').eq('id', membership.organizationId).maybeSingle(),
  ]);

  const displayName = profile?.full_name || profile?.email || user.email || 'User';
  const initials = displayName.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  const orgName = org?.name ?? 'Organization';
  const avatarUrl = profile?.avatar_path || null;

  // Single props object shared by both shells so they cannot drift apart.
  const shellProps = {
    displayName,
    initials,
    avatarUrl,
    membership: {
      memberId: membership.memberId,
      organizationId: membership.organizationId,
      organizationName: orgName,
      roles: membership.roles,
      permissions: membership.permissions,
      isDemo: membership.isDemo,
      workspaceType: membership.workspaceType,
    },
  };

  // The one branch point for all 43 dashboard pages. Resolved on the server
  // (see lib/native/server.ts) so the correct shell is in the first paint —
  // a client-side switch would flash the desktop sidebar inside the app.
  const isNative = await getIsNative();

  return (
      <div className="flex flex-col h-[100dvh]">
        <DemoBanner />
        {isNative ? (
          <MobileDashboardShell {...shellProps}>{children}</MobileDashboardShell>
        ) : (
          <DashboardShell {...shellProps}>{children}</DashboardShell>
        )}
      </div>
  );
}
