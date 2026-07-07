import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  rememberDevice: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  // Extract IP for basic rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('remote-addr') || 'unknown';
  if (!(await checkRateLimit(ip, 50, 300))) {
    return Response.json({ data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many failed login attempts. Please try again later.' } }, { status: 429 });
  }

  return handle(async () => {
    const body = schema.parse(await req.json());
    const supabase = await createClient(); // For setting cookies
    const admin = createAdminClient();     // For bypassing RLS on username lookup

    // Determine if identifier is email or username
    const isEmail = body.identifier.includes('@');
    let emailToLogin = body.identifier;

    if (!isEmail) {
      // Lookup username securely
      const normalized = body.identifier.trim().toLowerCase();
      const { data: profile } = await admin
        .from('profiles')
        .select('email')
        .eq('username_normalized', normalized)
        .maybeSingle();

      if (!profile?.email) {
        // Consume similar time to a real password check so callers can't enumerate
        // valid usernames by measuring response latency.
        await supabase.auth.signInWithPassword({
          email: `no-such-user-${Date.now()}@invalid.handoff.internal`,
          password: body.password,
        });
        throw Errors.unauthenticated('Invalid username/email or password.');
      }
      emailToLogin = profile.email;
    }

    // Attempt Supabase Auth login
    const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
      email: emailToLogin,
      password: body.password,
    });

    if (authError || !authData.user) {
      throw Errors.unauthenticated('Invalid username/email or password.');
    }

    // Determine post-login redirect
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id, is_active, employment_status')
      .eq('user_id', authData.user.id);

    const allMemberships = memberships || [];
    const activeMemberships = allMemberships.filter(m => m.is_active);

    let redirectUrl = '/dashboard';

    if (activeMemberships.length > 1) {
      redirectUrl = '/select-workspace';
    } else if (activeMemberships.length === 1) {
      // Optional: Set handoff_active_org cookie here for convenience, but next-js middleware or
      // UI can do it. For now, /dashboard will pick the first active one automatically.
      redirectUrl = '/dashboard';
    } else {
      // 0 active memberships
      const hasSuspended = allMemberships.some(m => m.employment_status === 'SUSPENDED');
      if (hasSuspended) {
        // Sign out immediately to block access
        await supabase.auth.signOut();
        throw Errors.forbidden('Your access has been suspended.');
      } else {
        redirectUrl = '/onboarding';
      }
    }

    return ok({ redirectUrl });
  });
}
