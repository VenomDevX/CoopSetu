import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters').max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/* ── POST /api/v1/profile/password ─── Change password ───────── */
export async function POST(req: NextRequest) {
  return handle(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw Errors.unauthenticated();

  const body = passwordSchema.parse(await req.json());

  // Verify the current password by attempting a sign-in
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: body.currentPassword,
  });

  if (verifyErr) {
    throw Errors.validation('Current password is incorrect.');
  }

  // Update the password
  const { error: updateErr } = await supabase.auth.updateUser({
    password: body.newPassword,
  });

  if (updateErr) {
    throw Errors.internal('Failed to update password.');
  }

  return ok({ message: 'Password updated successfully.' });
  });
}
