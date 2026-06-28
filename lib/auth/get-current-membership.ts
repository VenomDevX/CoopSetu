import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const ACTIVE_ORG_COOKIE = 'handoff_active_org';

export interface Membership {
  memberId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
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
export async function getCurrentMembership(
  organizationId?: string,
): Promise<Membership | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const preferredOrg = organizationId ?? cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  // Try the preferred org first; fall back to first active membership.
  async function resolve(orgId?: string) {
    let q = supabase
      .from('organization_members')
      .select('id, organization_id, is_active')
      .eq('user_id', user!.id)
      .eq('is_active', true);
    if (orgId) q = q.eq('organization_id', orgId);
    return (await q.limit(1).maybeSingle()).data;
  }

  let member = preferredOrg ? await resolve(preferredOrg) : null;
  if (!member) member = await resolve(); // cookie stale/invalid → default
  if (!member) return null;

  // roles
  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('roles(code)')
    .eq('organization_member_id', member.id);

  const roles = (roleRows ?? [])
    .map((r: { roles: { code: string } | { code: string }[] | null }) =>
      Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code,
    )
    .filter(Boolean) as string[];

  // permissions (via RPC-free join handled in DB helper has_permission; here we
  // resolve the flat list for UI gating)
  const { data: permRows } = await supabase.rpc('member_permissions', {
    p_member: member.id,
  });

  const permissions = Array.isArray(permRows)
    ? (permRows as { permission_code: string }[]).map((p) => p.permission_code)
    : [];

  return {
    memberId: member.id,
    organizationId: member.organization_id,
    roles,
    permissions,
  };
}
