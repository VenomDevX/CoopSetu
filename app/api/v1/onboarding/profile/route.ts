import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isReservedUsername } from '@/lib/auth/reserved-identifiers';

const schema = z.object({
  // Any alphabet/script (Unicode letters + marks) — names aren't Latin-only.
  fullName: z.string().min(1).max(100).regex(/^[\p{L}\p{M}\s'.\-]+$/u),
  username: z.string().min(3).max(30).regex(/^[a-z0-9\._\-]+$/).refine(s => !s.includes(' ') && !s.includes('..')),
  jobFamily: z.string().min(1),
  jobTitle: z.string().min(2).max(80),
  managerType: z.string().optional(),
  specialization: z.string().min(2).max(100),
  professionalDescription: z.string().max(500).optional(),
  timezone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw Errors.unauthenticated('Not authenticated');
    }

    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const normalizedUsername = body.username.trim().toLowerCase();

    if (isReservedUsername(normalizedUsername)) {
      throw Errors.validation('Username is no longer available.');
    }

    // Check username availability
    const { data: existingUser } = await admin
      .from('profiles')
      .select('id')
      .eq('username_normalized', normalizedUsername)
      .neq('id', user.id) // Exclude current user in case they are re-saving
      .maybeSingle();

    if (existingUser) {
      throw Errors.validation('Username is no longer available.');
    }

    // Update the profile
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        full_name: body.fullName,
        username: body.username.trim(),
        username_normalized: normalizedUsername,
        job_title: body.jobTitle,
        timezone: body.timezone || 'UTC',
        profile_completed_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      if (updateError.code === '23505') { // Unique violation
        throw Errors.validation('Username is no longer available.');
      }
      throw Errors.internal('Failed to update profile');
    }

    return ok({ success: true });
  });
}
