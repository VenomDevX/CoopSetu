import { Errors } from '@/lib/api/errors';
import { getCurrentMembership, type Membership } from './get-current-membership';

/**
 * Resolve the caller's active membership for the given org (or their default
 * org). Throws 403 if they are not an active member.
 */
export async function requireOrganization(organizationId?: string): Promise<Membership> {
  const membership = await getCurrentMembership(organizationId);
  if (!membership) {
    throw Errors.forbidden('You are not a member of this organization.');
  }
  return membership;
}

/** True if the membership holds the permission (admins implicitly hold all). */
export function hasPermission(membership: Membership, permission: string): boolean {
  return (
    membership.roles.includes('ORG_ADMIN') ||
    membership.roles.includes('SUPER_ADMIN') ||
    membership.permissions.includes(permission)
  );
}

/** Throw 403 unless the membership holds the given permission. */
export function requirePermission(membership: Membership, permission: string) {
  if (!hasPermission(membership, permission)) {
    throw Errors.forbidden();
  }
}

/** Throw 403 unless the membership holds at least one of the given permissions. */
export function requireAnyPermission(membership: Membership, permissions: string[]) {
  if (!permissions.some((p) => hasPermission(membership, p))) {
    throw Errors.forbidden();
  }
}
