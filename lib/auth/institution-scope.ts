import { createAdminClient } from '@/lib/supabase/admin';
import type { Membership } from '@/lib/auth/get-current-membership';
import { hasPermission as syncHasPermission } from '@/lib/auth/require-organization';

/**
 * Institution scope for a caller: null means national scope (sees/manages
 * every institution in the org, e.g. SUPER_ADMIN); a value means the caller
 * is pinned to that institution and must never be allowed to read or write
 * data belonging to a different one. Mirrors the DB-level scoping rule in
 * coopsetu.can_access_institution() (supabase/migrations/0084), for the
 * routes below that use the service-role client and so must enforce this
 * themselves instead of relying on RLS.
 */
export async function getCallerInstitutionId(memberId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('organization_members')
    .select('institution_id')
    .eq('id', memberId)
    .maybeSingle();
  return data?.institution_id ?? null;
}

/** True if the caller's membership carries the given permission code. */
export async function hasPermission(membership: Membership, code: string): Promise<boolean> {
  return syncHasPermission(membership, code);
}
