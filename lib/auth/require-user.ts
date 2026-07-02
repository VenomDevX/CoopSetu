import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Errors } from '@/lib/api/errors';
import type { User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Resolve the current user (or null) once per request. Wrapped in React's
 * `cache()` so the handler → service → audit-log chain, which each used to
 * call `supabase.auth.getUser()` independently, shares a single round-trip.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
});

/** Resolve the authenticated user or throw 401. */
export async function requireUser(): Promise<{ user: User; supabase: AuthContext['supabase'] }> {
  const { user, supabase } = await getAuthContext();
  if (!user) throw Errors.unauthenticated();
  return { user, supabase };
}
