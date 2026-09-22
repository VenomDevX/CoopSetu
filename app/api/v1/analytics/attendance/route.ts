import { NextRequest } from 'next/server';
import { handle, ok, fail } from '@/lib/api/response';
import { requireOrganization, requireAnyPermission } from '@/lib/auth/require-organization';
import { getCallerInstitutionId } from '@/lib/auth/institution-scope';
import { createClient } from '@/lib/supabase/server';
import { istDayKey } from '@/lib/attendance/time';

/**
 * GET /api/v1/analytics/attendance
 *
 * Aggregated attendance analytics: byDay, byCourse, byBatch, byInstitution,
 * byMethod, byDevice, absentDays, lowAttendance.
 *
 * Query params:
 *   days          — lookback window (default 30)
 *   institution_id — narrow to one institution (org-wide callers only)
 *   batch_id      — narrow to one batch
 *   threshold     — low attendance threshold % (default 75)
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const membership = await requireOrganization();
    requireAnyPermission(membership, ['attendance:manage', 'analytics:view']);

    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const institutionFilter = searchParams.get('institution_id');
    const batchFilter = searchParams.get('batch_id');
    const threshold = parseInt(searchParams.get('threshold') || '75', 10);

    const supabase = await createClient();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // Caller's institution scope
    const callerInstitutionId = await getCallerInstitutionId(membership.memberId);

    // Fetch all attendance records in scope
    let query = supabase
      .from('attendance_records')
      .select(`
        id, member_id, trainee_id, method, status, marked_at, source, device_id, session_id,
        member:member_id ( institution_id ),
        session:session_id (
          batch_id, session_type,
          batches ( name, programme_id, programmes ( title, institution_id ) )
        ),
        device:device_id ( device_name, label )
      `)
      .gte('marked_at', since)
      .order('marked_at', { ascending: false })
      .limit(5000);

    // Fetch through the caller client. RLS is the primary organization,
    // institution, trainer-batch, and self-scope enforcement.
    const { data: allRecords, error: recErr } = await query;
    if (recErr) {
      return fail('INTERNAL', recErr.message, 500);
    }

    let records = allRecords || [];

    // Apply institution filter
    if (callerInstitutionId || institutionFilter) {
      const filterInst = callerInstitutionId || institutionFilter;
      records = records.filter((r: any) => {
        const memberInst = r.member?.institution_id;
        return memberInst === filterInst || !memberInst;
      });
    }

    // Apply batch filter
    if (batchFilter) {
      records = records.filter((r: any) =>
        r.session && (r.session as any).batch_id === batchFilter
      );
    }

    // Expected attendance is session x enrolled roster. Missing rows are
    // ABSENT; they are intentionally never persisted.
    let sessionQuery = supabase
      .from('attendance_sessions')
      .select(`
        id, date, batch_id,
        batches ( name, trainer_id, programme_id, programmes ( title, institution_id, institutions ( name ) ) )
      `)
      .gte('date', istDayKey(since))
      .lte('date', istDayKey(new Date()));
    if (batchFilter) sessionQuery = sessionQuery.eq('batch_id', batchFilter);
    const { data: visibleSessions } = await sessionQuery;
    let scopedSessions = visibleSessions || [];
    if (membership.roles.includes('TRAINER') && !membership.roles.some(role => ['ORG_ADMIN', 'SUPER_ADMIN', 'INSTITUTE_ADMIN'].includes(role))) {
      const { data: auth } = await supabase.auth.getUser();
      const { data: trainer } = auth.user
        ? await supabase.from('trainers').select('id').eq('user_id', auth.user.id).maybeSingle()
        : { data: null };
      scopedSessions = scopedSessions.filter((session: any) => session.batches?.trainer_id === trainer?.id);
    }
    const expectedBatchIds = [...new Set(scopedSessions.map((session: any) => session.batch_id))];
    const { data: visibleEnrollments } = expectedBatchIds.length
      ? await supabase.from('enrollments').select('batch_id, trainee_id').in('batch_id', expectedBatchIds).eq('status', 'ENROLLED')
      : { data: [] };
    const traineesByBatch = new Map<string, string[]>();
    for (const enrollment of visibleEnrollments || []) {
      const list = traineesByBatch.get(enrollment.batch_id as string) || [];
      list.push(enrollment.trainee_id as string);
      traineesByBatch.set(enrollment.batch_id as string, list);
    }
    const sessionById = new Map(scopedSessions.map((session: any) => [session.id, session]));

    // === byDay ===
    const dayMap = new Map<string, { present: number; late: number; total: number }>();
    for (const session of scopedSessions as any[]) {
      const bucket = dayMap.get(session.date) || { present: 0, late: 0, total: 0 };
      bucket.total += (traineesByBatch.get(session.batch_id) || []).length;
      dayMap.set(session.date, bucket);
    }
    for (const r of records) {
      const day = istDayKey(r.marked_at);
      const b = dayMap.get(day) || { present: 0, late: 0, total: 0 };
      if (!r.session_id || !sessionById.has(r.session_id)) b.total += 1;
      if (r.status === 'PRESENT') b.present += 1;
      if (r.status === 'LATE') b.late += 1;
      dayMap.set(day, b);
    }
    const byDay = [...dayMap.entries()]
      .map(([date, b]) => ({ date, ...b, absent: Math.max(0, b.total - b.present - b.late), pct: b.total > 0 ? Math.round(((b.present + b.late) / b.total) * 100) : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // === byCourse ===
    const courseMap = new Map<string, { title: string; present: number; total: number }>();
    for (const session of scopedSessions as any[]) {
      const programme = session.batches?.programmes;
      if (!programme) continue;
      const key = session.batches.programme_id || programme.title;
      const bucket = courseMap.get(key) || { title: programme.title, present: 0, total: 0 };
      bucket.total += (traineesByBatch.get(session.batch_id) || []).length;
      courseMap.set(key, bucket);
    }
    for (const r of records) {
      const sess = r.session as any;
      if (!sess?.batches?.programmes) continue;
      const title = sess.batches.programmes.title;
      const key = sess.batches.programme_id || title;
      const b = courseMap.get(key) || { title, present: 0, total: 0 };
      if (!r.session_id || !sessionById.has(r.session_id)) b.total += 1;
      if (r.status === 'PRESENT' || r.status === 'LATE') b.present += 1;
      courseMap.set(key, b);
    }
    const byCourse = [...courseMap.entries()]
      .map(([id, b]) => ({ id, title: b.title, present: b.present, total: b.total, pct: b.total > 0 ? Math.round((b.present / b.total) * 100) : 0 }));

    // === byBatch ===
    const batchMap = new Map<string, { name: string; present: number; total: number }>();
    for (const session of scopedSessions as any[]) {
      const key = session.batch_id;
      const bucket = batchMap.get(key) || { name: session.batches?.name || key, present: 0, total: 0 };
      bucket.total += (traineesByBatch.get(key) || []).length;
      batchMap.set(key, bucket);
    }
    for (const r of records) {
      const sess = r.session as any;
      if (!sess?.batches) continue;
      const name = sess.batches.name;
      const key = sess.batch_id || name;
      const b = batchMap.get(key) || { name, present: 0, total: 0 };
      if (!r.session_id || !sessionById.has(r.session_id)) b.total += 1;
      if (r.status === 'PRESENT' || r.status === 'LATE') b.present += 1;
      batchMap.set(key, b);
    }
    const byBatch = [...batchMap.entries()]
      .map(([id, b]) => ({ id, name: b.name, present: b.present, total: b.total, pct: b.total > 0 ? Math.round((b.present / b.total) * 100) : 0 }));

    // === byMethod ===
    const methodMap = new Map<string, number>();
    for (const r of records) {
      methodMap.set(r.method, (methodMap.get(r.method) || 0) + 1);
    }
    const byMethod = [...methodMap.entries()].map(([method, count]) => ({ method, count }));

    // === byDevice ===
    const deviceMap = new Map<string, { name: string; count: number }>();
    for (const r of records) {
      if (!r.device_id || !r.device) continue;
      const dev = r.device as any;
      const name = dev.device_name || dev.label || 'Unknown';
      const b = deviceMap.get(r.device_id) || { name, count: 0 };
      b.count += 1;
      deviceMap.set(r.device_id, b);
    }
    const byDevice = [...deviceMap.entries()]
      .map(([id, b]) => ({ id, name: b.name, count: b.count }))
      .sort((a, b) => b.count - a.count);

    const institutionMap = new Map<string, { name: string; present: number; total: number }>();
    for (const session of scopedSessions as any[]) {
      const institutionId = session.batches?.programmes?.institution_id;
      if (!institutionId) continue;
      const bucket = institutionMap.get(institutionId) || {
        name: session.batches?.programmes?.institutions?.name || institutionId,
        present: 0,
        total: 0,
      };
      bucket.total += (traineesByBatch.get(session.batch_id) || []).length;
      institutionMap.set(institutionId, bucket);
    }
    for (const record of records as any[]) {
      const session = record.session_id ? sessionById.get(record.session_id) as any : null;
      const institutionId = session?.batches?.programmes?.institution_id;
      if (!institutionId) continue;
      const bucket = institutionMap.get(institutionId);
      if (bucket && (record.status === 'PRESENT' || record.status === 'LATE')) bucket.present += 1;
    }
    const byInstitution = [...institutionMap.entries()].map(([id, bucket]) => ({
      id, name: bucket.name, present: bucket.present, total: bucket.total,
      pct: bucket.total ? Math.round((bucket.present / bucket.total) * 100) : 0,
    }));

    // === lowAttendance (members below threshold) ===
    const memberAttendance = new Map<string, { present: number; total: number }>();
    const memberByTrainee = new Map<string, string>();
    for (const record of records as any[]) if (record.trainee_id) memberByTrainee.set(record.trainee_id, record.member_id);
    for (const session of scopedSessions as any[]) {
      for (const traineeId of traineesByBatch.get(session.batch_id) || []) {
        const memberId = memberByTrainee.get(traineeId);
        if (!memberId) continue;
        const bucket = memberAttendance.get(memberId) || { present: 0, total: 0 };
        bucket.total += 1;
        memberAttendance.set(memberId, bucket);
      }
    }
    for (const r of records) {
      const b = memberAttendance.get(r.member_id) || { present: 0, total: 0 };
      if (!r.session_id || !sessionById.has(r.session_id)) b.total += 1;
      if (r.status === 'PRESENT' || r.status === 'LATE') b.present += 1;
      memberAttendance.set(r.member_id, b);
    }
    const lowAttendance = [...memberAttendance.entries()]
      .filter(([, b]) => b.total > 0 && Math.round((b.present / b.total) * 100) < threshold)
      .map(([memberId, b]) => ({
        memberId,
        pct: Math.round((b.present / b.total) * 100),
        present: b.present,
        total: b.total,
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 20);

    const absentDays = byDay.filter(day => day.absent > 0).map(day => ({ date: day.date, count: day.absent }));
    const totalExpected = byDay.reduce((sum, day) => sum + day.total, 0);
    const totalPresent = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;

    return ok({
      days,
      byDay,
      byCourse,
      byBatch,
      byInstitution,
      byMethod,
      byDevice,
      absentDays,
      lowAttendance,
      summary: {
        totalRecords: totalExpected,
        totalPresent,
        totalAbsent: Math.max(0, totalExpected - totalPresent),
        overallPct: totalExpected > 0
          ? Math.round((totalPresent / totalExpected) * 100)
          : 0,
      },
    });
  });
}
