import type { User } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import type { AuthContext } from '@/lib/auth/require-user';
import { getLegalStatus } from './get-legal-status';

/**
 * Throws 403 (LEGAL_ACCEPTANCE_REQUIRED via Errors.forbidden) unless `user`
 * has accepted the active Terms + Privacy documents. Anonymous/demo sessions
 * (`user.is_anonymous`) are always exempt -- demo visitors are shown a notice
 * instead of a checkbox and never get an acceptance record.
 *
 * Wire this into every route that creates real account/workspace state:
 * invite acceptance, join-team, organization creation, AI use, etc.
 */
export async function requireLegalAccepted(
  user: User,
  supabase: AuthContext['supabase'],
): Promise<void> {
  if (user.is_anonymous) return;

  const status = await getLegalStatus(user, supabase);
  if (!status.isAccepted) {
    throw Errors.forbidden('Please accept the Terms of Service and Privacy Policy to continue.');
  }
}
