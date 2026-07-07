import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { isIpAllowed } from '@/lib/security/ip-utils';
import { Errors } from '@/lib/api/errors';
import { getAuthContext } from './require-user';

export const ACTIVE_ORG_COOKIE = 'handoff_active_org';

export interface Membership {
  memberId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  isDemo?: boolean;
  workspaceType?: 'ENTERPRISE' | 'STUDENT_SOLO' | 'STUDENT_TEAM';
}

/**
 * Resolve the caller's active membership, including effective roles and
 * permissions. Org selection precedence:
 *   1. explicit `organizationId` argument
 *   2. the `handoff_active_org` cookie (set by the org switcher)
 *   3. the user's first active membership
 * The chosen org is always re-validated against `organization_members` (RLS +
 * this query), so a forged cookie cannot grant access to an org the user isn't
 * an active member of.
 */
export const getCurrentMembership = cache(async (
  organizationId?: string,
): Promise<Membership | null> => {
  const { user, supabase } = await getAuthContext();
  if (!user) return null;

  const cookieStore = await cookies();
  const preferredOrg = organizationId ?? cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  // Try the preferred org first; fall back to first active membership.
  async function resolve(orgId?: string) {
    let q = supabase
      .from('organization_members')
      .select('id, organization_id, is_active, organizations(is_demo, ip_allowlist, workspace_type)')
      .eq('user_id', user!.id)
      .eq('is_active', true);
    if (orgId) q = q.eq('organization_id', orgId);
    return (await q.limit(1).maybeSingle()).data;
  }

  let member = preferredOrg ? await resolve(preferredOrg) : null;
  if (!member) member = await resolve(); // cookie stale/invalid → default
  if (!member) return null;

  // Verify IP Allowlist
  const orgData = member.organizations as any; // Type workaround for join
  const ipAllowlist = orgData?.ip_allowlist as string[] | undefined;
  
  if (ipAllowlist && ipAllowlist.length > 0) {
    const headersList = await headers();
    const clientIp = headersList.get('x-forwarded-for')?.split(',')[0].trim() || headersList.get('x-real-ip') || '127.0.0.1';
    
    if (!isIpAllowed(clientIp, ipAllowlist)) {
      throw Errors.forbidden('IP Address Denied by Organization Policy');
    }
  }

  // roles
  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('role_id, roles(code)')
    .eq('organization_member_id', member.id);

  const roles = (roleRows ?? [])
    .map((r: { roles: { code: string } | { code: string }[] | null }) =>
      Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code,
    )
    .filter(Boolean) as string[];

  const roleIds = (roleRows ?? [])
    .map((r: { role_id?: string | null }) => r.role_id)
    .filter(Boolean) as string[];

  // Resolve the flat list for UI/API gating through normal authenticated RLS.
  // The SECURITY DEFINER member_permissions RPC is intentionally not callable
  // by authenticated users after the hardening migrations.
  const { data: permRows } = roleIds.length
    ? await supabase
      .from('role_permissions')
      .select('permission_code')
      .in('role_id', roleIds)
    : { data: [] };

  const permissions = Array.from(new Set(
    ((permRows ?? []) as { permission_code: string }[]).map((p) => p.permission_code),
  ));

  return {
    memberId: member.id,
    organizationId: member.organization_id,
    roles,
    permissions: Array.from(permissions),
    isDemo: orgData?.is_demo,
    workspaceType: orgData?.workspace_type ?? 'ENTERPRISE',
  };
});
