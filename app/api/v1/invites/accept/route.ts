import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({ token: z.string().min(1) });

const MESSAGES: Record<string, string> = {
  INVITE_NOT_FOUND: 'This invite link is invalid.',
  INVITE_NOT_PENDING: 'This invite has already been used or revoked.',
  INVITE_EXPIRED: 'This invite has expired.',
  INVITE_EMAIL_MISMATCH: 'This invite was sent to a different email address.',
};

/** Look up invite details (for the accept page) — public RPC. */
export async function GET(req: Request) {
  return handle(async () => {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) throw Errors.validation('Missing token.');
    await requireUser();
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_invite', { p_token: token });
    if (error) throw Errors.internal(error.message);
    const invite = Array.isArray(data) ? data[0] : data;
    if (!invite) throw Errors.notFound('Invite not found.');
    return ok(invite);
  });
}

/** Accept an invite for the current user. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireUser();
    const admin = createAdminClient();
    const { token } = schema.parse(await req.json());
    const { data, error } = await admin.rpc('accept_invite', { p_token: token });
    if (error) {
      const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
      throw key ? Errors.validation(MESSAGES[key]) : Errors.internal(error.message);
    }
    const orgId = data as string;
    const res = ok({ organization_id: orgId });
    (res as NextResponse).cookies.set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return res as NextResponse;
  });
}
