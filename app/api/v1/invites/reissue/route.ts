import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({ inviteId: z.string().uuid() });

/**
 * Reissue a token for a pending invite.
 * Only works if the authenticated user's email matches the invite exactly.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { user } = await requireUser();
    
    if (!user.email) {
      throw Errors.forbidden('Your account must have a verified email address.');
    }

    const { inviteId } = schema.parse(await req.json());
    const admin = createAdminClient();

    // 1. Fetch the invite strictly matching the user's email and pending status
    const { data: invite, error: fetchError } = await admin
      .from('organization_invites')
      .select('id, token, status, expires_at')
      .eq('id', inviteId)
      .eq('email', user.email)
      .eq('status', 'PENDING')
      .single();

    if (fetchError || !invite) {
      throw Errors.notFound('Invite not found, expired, or does not belong to you.');
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw Errors.validation('This invite has expired.');
    }

    // 2. We can securely return the token because we've proven the user owns the matching email.
    // However, to ensure it's a one-time flow and prevent token leakage from past emails,
    // we generate a fresh token, update the row, and return the new token.
    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    const { error: updateError } = await admin
      .from('organization_invites')
      .update({ token: newToken })
      .eq('id', inviteId)
      .eq('status', 'PENDING');

    if (updateError) {
      throw Errors.internal('Failed to reissue invite token.');
    }

    // 3. Optional: Write an audit event for reissue (we'll rely on the accept action for the main audit)
    return ok({ token: newToken });
  });
}
