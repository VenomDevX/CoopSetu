import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/get-current-membership';

const schema = z.object({ organization_id: z.string().uuid() });

/** Set the caller's active organization (validated against membership). */
export async function POST(req: Request) {
  return handle(async () => {
    const { user, supabase } = await requireUser();
    const { organization_id } = schema.parse(await req.json());

    const { data: member } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .maybeSingle();
    if (!member) throw Errors.forbidden('You are not an active member of that organization.');

    const res = ok({ organization_id });
    (res as NextResponse).cookies.set(ACTIVE_ORG_COOKIE, organization_id, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return res as NextResponse;
  });
}
