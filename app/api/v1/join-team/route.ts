import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { joinCodeSchema } from '@/lib/validation/student-team';
import { redeemJoinCode } from '@/services/student-workspace.service';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/get-current-membership';
import { requireLegalAccepted } from '@/lib/legal/require-legal-accepted';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!(await checkRateLimit(`joincode-redeem:${ip}`, 5, 300))) {
      throw Errors.badRequest('Too many requests. Please try again later.');
    }

    const { user, supabase } = await requireUser();
    await requireLegalAccepted(user, supabase);
    const { code } = joinCodeSchema.parse(await req.json());

    const org = await redeemJoinCode(supabase, user.id, code);

    const res = ok({ organizationId: org.id });
    res.cookies.set(ACTIVE_ORG_COOKIE, org.id, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  });
}
