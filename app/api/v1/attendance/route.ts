import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { AttendanceService } from '@/services/attendance.service';

const uuid = z.guid();

// Only the listed fields reach the service: the body used to be spread into the
// insert, letting a caller set any attendance column.
const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_session'),
    batch_id: uuid,
    session_type: z.enum(['LECTURE', 'LAB', 'WORKSHOP', 'EXAM']).optional(),
    session_slot: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY']).optional(),
    trainer_id: uuid.optional(),
  }),
  z.object({
    action: z.literal('mark'),
    session_id: uuid,
    trainee_id: uuid,
    method: z.literal('MANUAL').optional(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  }),
  z.object({ action: z.literal('close_session'), session_id: uuid }),
]);

// Session management and manual marking are staff actions. Members check in via
// QR / RFID / device face, which use their own authenticated routes.
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'attendance:manage');
    const svc = new AttendanceService(supabase);
    const body = postSchema.parse(await req.json());

    switch (body.action) {
      case 'create_session': {
        const { action: _a, ...input } = body;
        return ok(await svc.createSession(input), undefined, 201);
      }
      case 'mark': {
        const { action: _a, ...input } = body;
        return ok(await svc.markAttendance(input), undefined, 201);
      }
      case 'close_session':
        await svc.closeSession(body.session_id);
        return ok({ success: true });
    }
  });
}

// Reads are scoped by RLS (self, trainer-of-batch, attendance:manage).
export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const params = new URL(req.url).searchParams;
    const batchId = params.get('batch_id');
    const traineeId = params.get('trainee_id');
    const sessionId = params.get('session_id');
    const svc = new AttendanceService(supabase);

    if (sessionId && params.get('records')) {
      return ok({ records: await svc.getSessionRecords(uuid.parse(sessionId)) });
    }
    if (batchId) {
      const id = uuid.parse(batchId);
      const [sessions, stats] = await Promise.all([svc.getBatchSessions(id), svc.getAttendanceStats(id)]);
      return ok({ sessions, stats });
    }
    if (traineeId) {
      return ok({ records: await svc.getTraineeAttendance(uuid.parse(traineeId)) });
    }
    throw Errors.badRequest('batch_id or trainee_id required');
  });
}
