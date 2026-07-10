import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireLegalAccepted } from '@/lib/legal/require-legal-accepted';
import { createStudentTeamSchema } from '@/lib/validation/student-team';
import { createStudentTeam } from '@/services/student-workspace.service';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/get-current-membership';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user, supabase } = await requireUser();
    await requireLegalAccepted(user, supabase);
    const body = createStudentTeamSchema.parse(await req.json());

    const team = await createStudentTeam(supabase, user.id, body);

    const res = ok({
      organizationId: team.organizationId,
      name: team.name,
      slug: team.slug,
      joinCode: team.joinCode,
    }, undefined, 201);
    res.cookies.set(ACTIVE_ORG_COOKIE, team.organizationId, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  });
}
