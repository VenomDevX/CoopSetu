import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { Errors } from '@/lib/api/errors';
import { getJoinCodeStatus, rotateJoinCode, revokeJoinCode } from '@/services/student-workspace.service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { supabase } = await requireUser();
    const membership = await requireOrganization(id);
    requirePermission(membership, 'student_team:manage_join_code');

    const status = await getJoinCodeStatus(supabase, id);
    return ok({ status });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!(await checkRateLimit(`joincode-rotate:${ip}`, 10, 300))) {
      throw Errors.badRequest('Too many requests. Please try again later.');
    }

    const { user, supabase } = await requireUser();
    const membership = await requireOrganization(id);
    requirePermission(membership, 'student_team:manage_join_code');

    const rawCode = await rotateJoinCode(supabase, user.id, id);
    return ok({ joinCode: rawCode });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    const membership = await requireOrganization(id);
    requirePermission(membership, 'student_team:manage_join_code');

    await revokeJoinCode(supabase, user.id, id);
    return ok({ revoked: true });
  });
}
