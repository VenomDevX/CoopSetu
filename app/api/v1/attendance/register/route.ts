import { NextRequest } from 'next/server';
import { handle, ok, fail } from '@/lib/api/response';
import { requireOrganization } from '@/lib/auth/require-organization';
import { createClient } from '@/lib/supabase/server';
import { istDayKey } from '@/lib/attendance/time';

/**
 * GET /api/v1/attendance/register
 *
 * Roster grid: every enrolled trainee for a batch+date, with their attendance
 * record if one exists, or ABSENT (computed, never stored).
 *
 * Query params:
 *   batch_id — required
 *   date     — YYYY-MM-DD (defaults to today IST)
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const membership = await requireOrganization();
    const { searchParams } = request.nextUrl;

    const batchId = searchParams.get('batch_id');
    if (!batchId) {
      return fail('BAD_REQUEST', 'batch_id is required', 400);
    }

    const dateParam = searchParams.get('date') || istDayKey(new Date());
    const supabase = await createClient();

    // 1. Get all enrolled trainees for this batch
    const { data: enrollments, error: enrollErr } = await supabase
      .from('enrollments')
      .select(`
        trainee_id,
        trainees (
          id, user_id,
          profiles:user_id ( full_name, avatar_path )
        )
      `)
      .eq('batch_id', batchId)
      .eq('status', 'ENROLLED');

    if (enrollErr) {
      return fail('INTERNAL', enrollErr.message, 500);
    }

    // 2. Get attendance sessions for this batch+date
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id, session_type, session_slot, is_active')
      .eq('batch_id', batchId)
      .eq('date', dateParam);

    const sessionIds = (sessions || []).map((s: any) => s.id);

    // 3. Get attendance records for those sessions
    let records: any[] = [];
    if (sessionIds.length > 0) {
      const { data: recs } = await supabase
        .from('attendance_records')
        .select('id, session_id, trainee_id, member_id, method, status, marked_at, source, device_id')
        .in('session_id', sessionIds);
      records = recs || [];
    }

    // 4. Build the roster grid — mark each trainee's attendance
    const recordsByTrainee = new Map<string, any>();
    for (const rec of records) {
      if (rec.trainee_id && !recordsByTrainee.has(rec.trainee_id)) {
        recordsByTrainee.set(rec.trainee_id, rec);
      }
    }

    const roster = (enrollments || []).map((e: any) => {
      const trainee = e.trainees as any;
      const record = recordsByTrainee.get(e.trainee_id);
      return {
        traineeId: e.trainee_id,
        name: trainee?.profiles?.full_name ?? 'Unknown',
        avatar: trainee?.profiles?.avatar_path ?? null,
        status: record?.status ?? 'ABSENT',
        method: record?.method ?? null,
        markedAt: record?.marked_at ?? null,
        source: record?.source ?? null,
        recordId: record?.id ?? null,
      };
    });

    // Sort: PRESENT first, then LATE, then ABSENT
    const statusOrder: Record<string, number> = { PRESENT: 0, LATE: 1, EXCUSED: 2, ABSENT: 3 };
    roster.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

    // Stats
    const total = roster.length;
    const present = roster.filter((r) => r.status === 'PRESENT').length;
    const late = roster.filter((r) => r.status === 'LATE').length;
    const absent = roster.filter((r) => r.status === 'ABSENT').length;

    // Batch info
    const { data: batch } = await supabase
      .from('batches')
      .select('name, programmes(title)')
      .eq('id', batchId)
      .maybeSingle();

    return ok({
      batchId,
      batchName: (batch as any)?.name ?? batchId,
      programmeName: (batch as any)?.programmes?.title ?? null,
      date: dateParam,
      sessions: sessions || [],
      roster,
      stats: { total, present, late, absent, percentage: total > 0 ? Math.round(((present + late) / total) * 100) : 0 },
    });
  });
}
