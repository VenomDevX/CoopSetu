import type { Membership } from '@/lib/auth/get-current-membership';
import { requirePermission, requireAnyPermission } from '@/lib/auth/require-organization';

/**
 * Enforce the AI access policy for an intent: the `ai:use` baseline always, plus
 * (when the intent declares any) at least one of its feature permissions. Throws
 * a 403 ApiError when unmet. UI gating mirrors this — it never replaces it.
 */
export function checkIntentPermissions(m: Membership, featurePermissions: string[]) {
  requirePermission(m, 'ai:use');
  if (featurePermissions.length > 0) {
    requireAnyPermission(m, featurePermissions);
  }
}
