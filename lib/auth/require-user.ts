import { createClient } from '@/lib/supabase/server';
import { Errors } from '@/lib/api/errors';
import type { User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/** Resolve the authenticated user or throw 401. */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw Errors.unauthenticated();
  return { user, supabase };
}
