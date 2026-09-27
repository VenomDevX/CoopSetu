import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { ApiError, Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, hasPermission, requirePermission } from '@/lib/auth/require-organization';
import { AttendanceService } from '@/services/attendance.service';

const embedding = z.array(z.number().finite()).length(128);

const bodySchema = z.discriminatedUnion('action', [
  // trainee_id omitted = the caller enrols their own face (id-card page).
  z.object({ action: z.literal('register'), trainee_id: z.string().uuid().optional(), embedding }),
  // trainee_id omitted = identify who it is among the session's batch.
  z.object({ action: z.literal('verify'), trainee_id: z.string().uuid().optional(), session_id: z.string().uuid(), embedding }),
]);

async function ownTraineeId(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string,
  organizationId: string,
): Promise<string> {
  const { data } = await supabase
    .from('trainees')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (!data) throw Errors.notFound('No trainee record for your account in this organization.');
  return data.id;
}

// Browser face capture. The embedding is computed client-side, so it proves
// nothing on its own: enrolling someone else and verifying (which marks
// attendance) are staff actions. Hardware terminals use /attendance/device-face.
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    const m = await requireOrganization();
    const body = bodySchema.parse(await req.json());
    const svc = new AttendanceService(supabase);

    try {
      if (body.action === 'register') {
        if (body.trainee_id) requirePermission(m, 'trainee:manage');
        const traineeId = body.trainee_id ?? (await ownTraineeId(supabase, user.id, m.organizationId));
        await svc.registerFaceEmbedding(traineeId, body.embedding);
        return ok({ success: true, message: 'Face registered successfully' }, undefined, 201);
      }

      if (!hasPermission(m, 'attendance:manage')) throw Errors.forbidden();
      return ok(
        body.trainee_id
          ? await svc.verifyFaceAndMarkAttendance(body.trainee_id, body.session_id, body.embedding)
          : await svc.identifyFaceAndMarkAttendance(body.session_id, body.embedding),
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // 42501 = raised by trainees_guard_self_service (e.g. re-enrolling a face).
      const e = err as { code?: string; message?: string };
      if (e?.code === '42501') throw Errors.forbidden(e.message);
      if (err instanceof Error && /not found|No face registered|Session is closed/i.test(err.message)) {
        throw Errors.badRequest(err.message);
      }
      throw err;
    }
  });
}
