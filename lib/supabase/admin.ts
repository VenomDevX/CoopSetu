import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client that BYPASSES RLS. SERVER ONLY.
 * Never import this from a file containing "use client".
 * Use only for trusted, audited admin operations (e.g. accepting an invite for
 * a user who is not yet a member). Most queries must use the request-scoped
 * server client so RLS applies.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('SUPABASE_SECRET_KEY is not set');

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
