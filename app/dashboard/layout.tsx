import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { DashboardShell } from '@/components/dashboard/shell';
import { DemoBanner } from '@/components/demo/demo-banner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const membership = await getCurrentMembership();
  if (!membership) redirect('/onboarding');

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
    supabase.from('organizations').select('name').eq('id', membership.organizationId).maybeSingle(),
  ]);

  const displayName = profile?.full_name || profile?.email || user.email || 'User';
  const initials = displayName.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  const orgName = org?.name ?? 'Organization';

  return (
      <div className="flex flex-col h-[100dvh]">
        <DemoBanner />
        <DashboardShell
          displayName={displayName}
          initials={initials}
          membership={{
            memberId: membership.memberId,
            organizationId: membership.organizationId,
            organizationName: orgName,
            roles: membership.roles,
            permissions: membership.permissions,
            isDemo: membership.isDemo,
            workspaceType: membership.workspaceType,
          }}
        >
          {children}
        </DashboardShell>
      </div>
  );
}
