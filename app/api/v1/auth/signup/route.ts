import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { isReservedUsername, isReservedWorkspaceSlug } from '@/lib/auth/reserved-identifiers';

const schema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).regex(/^[a-zA-Z\s'\-]+$/, 'Only letters, spaces, apostrophes, and hyphens allowed'),
  email: z.string().email('Invalid email address').transform(s => s.toLowerCase()),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9\._\-]+$/, 'Invalid username format').refine(s => !s.includes(' '), 'No spaces allowed').refine(s => !s.includes('..'), 'No consecutive dots').transform(s => s.toLowerCase()),
  jobFamily: z.string().min(1, 'Job family is required'),
  jobTitle: z.string().min(2).max(80).regex(/^[a-zA-Z0-9\s\-\&\/]+$/, 'Invalid job title characters'),
  managerType: z.string().optional(),
  specialization: z.string().min(2).max(100),
  professionalDescription: z.string().max(500).optional(),
  companyName: z.string().min(2).max(120).regex(/^[a-zA-Z0-9\s\&\-\.]+$/, 'Invalid company name characters'),
  workspaceSlug: z.string().min(3).max(50).regex(/^[a-z0-9\-]+$/, 'Invalid workspace slug characters').refine(s => !s.startsWith('-') && !s.endsWith('-') && !s.includes('--'), 'Invalid hyphen usage').transform(s => s.toLowerCase()),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  timezone: z.string().optional(),
}).strict().refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  
  if (!(await checkRateLimit(ip, 50, 3600))) {
    return Response.json({ data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many signup attempts. Please try again later.' } }, { status: 429 });
  }

  return handle(async () => {
    const body = schema.parse(await req.json());
    const supabase = await createClient();
    const admin = createAdminClient();

    const normalizedUsername = body.username.trim();
    const normalizedSlug = body.workspaceSlug.trim();

    if (isReservedUsername(normalizedUsername)) {
      throw Errors.validation('Username is no longer available.');
    }
    if (isReservedWorkspaceSlug(normalizedSlug)) {
      throw Errors.validation('Workspace slug is no longer available.');
    }

    // 1. Double check username and slug availability
    const [{ data: existingUser }, { data: existingOrg }] = await Promise.all([
      admin.from('profiles').select('id').eq('username_normalized', normalizedUsername).maybeSingle(),
      admin.from('organizations').select('id').eq('slug', normalizedSlug).maybeSingle()
    ]);

    if (existingUser) {
      throw Errors.validation('Username is no longer available.');
    }
    if (existingOrg) {
      throw Errors.validation('Workspace slug is no longer available.');
    }

    // 2. Create the user securely via Admin API (auto-confirms email for this flow)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
      },
    });

    if (authError || !authData.user) {
      if (authError?.message.includes('already registered')) {
        throw Errors.validation('An account with this email already exists.');
      }
      throw Errors.internal('Failed to create account.');
    }

    const userId = authData.user.id;

    // 3. Update the profile with the username and name
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        username: body.username.trim(),
        username_normalized: normalizedUsername,
        full_name: body.fullName,
      })
      .eq('id', userId);

    if (profileError) {
      // If updating the profile fails due to race condition on username, we should ideally rollback
      // but Supabase auth users cannot be deleted easily without admin rights, which we have here.
      await admin.auth.admin.deleteUser(userId);
      throw Errors.validation('Username was taken during registration.');
    }

    // 4. Log the user in to establish a session for RPC calls
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (signInError) {
      throw Errors.internal('Failed to establish session after registration.');
    }

    // 5. Call create_organization RPC via admin client (authenticated grant revoked)
    const { error: orgError, data: orgData } = await createAdminClient().rpc('create_organization', {
      p_user_id: userId,
      p_name: body.companyName,
      p_slug: normalizedSlug,
      p_industry: body.industry || null,
      p_company_size: body.companySize || null,
      p_timezone: body.timezone || 'UTC',
      p_description: null,
      p_job_family: body.jobFamily,
      p_job_title: body.jobTitle,
      p_professional_specialization: body.specialization || null,
      p_manager_type: body.managerType || null,
      p_job_description: body.professionalDescription || null,
    });

    if (orgError || !orgData) {
      console.error('Organization creation error:', orgError);
      throw Errors.internal('Account created, but failed to setup company. Please contact support.');
    }

    return ok({ redirectUrl: '/dashboard' });
  });
}
