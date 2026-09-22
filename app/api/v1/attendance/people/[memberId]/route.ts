import { NextRequest } from 'next/server';
import { handle, ok, fail } from '@/lib/api/response';
import { requireOrganization } from '@/lib/auth/require-organization';
import { createClient } from '@/lib/supabase/server';
import { istDayKey } from '@/lib/attendance/time';

/**
 * GET /api/v1/attendance/people/[memberId]
 *
 * Per-person attendance detail: overall %, per-day series, per-course breakdown,
 * absent days, streak, recent feed. Works for trainees and staff (the director).
 *
 * Query params:
 *   days — lookback window (default 60)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  return handle(async () => {
    const membership = await requireOrganization();
    const { memberId } = await params;
    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get('days') || '60', 10);

    const supabase = await createClient();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // Member info
    const { data: member, error: memberErr } = await supabase
      .from('organization_members')
      .select('id, user_id, institution_id, profiles:user_id(full_name, avatar_url, email)')
      .eq('id', memberId)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();

    if (memberErr || !member) {
      return fail('NOT_FOUND', 'Member not found', 404);
    }

    // All attendance records for this member
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select(`
        id, session_id, method, status, marked_at, source,
        session:session_id (
          id, date, session_type, batch_id,
          batches ( name, programme_id, programmes ( title ) )
        )
      `)
      .eq('member_id', memberId)
      .gte('marked_at', since)
      .order('marked_at', { ascending: false });

    if (recordsError) return fail('FORBIDDEN', 'Attendance is outside your scope', 403);

    const allRecords = records || [];

    // For trainees, absence is the lack of a row for an expected session.
    // Build that denominator from enrolled batches; never persist ABSENT rows.
    let scheduledSessions: { id: string; date: string }[] = [];
    const { data: trainee } = await supabase
      .from('trainees')
      .select('id')
      .eq('user_id', member.user_id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (trainee) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('batch_id')
        .eq('trainee_id', trainee.id)
        .in('status', ['ENROLLED', 'COMPLETED'])
        .not('batch_id', 'is', null);
      const batchIds = (enrollments || []).map(row => row.batch_id).filter(Boolean) as string[];
      if (batchIds.length > 0) {
        const sinceDay = istDayKey(since);
        const { data: expected } = await supabase
          .from('attendance_sessions')
          .select('id, date')
          .in('batch_id', batchIds)
          .gte('date', sinceDay)
          .lte('date', istDayKey(new Date()));
        scheduledSessions = (expected || []) as { id: string; date: string }[];
      }
    }

    // Per-day series
    const byDay = new Map<string, { present: number; late: number; absent: number; total: number }>();
    for (const session of scheduledSessions) {
      const bucket = byDay.get(session.date) || { present: 0, late: 0, absent: 0, total: 0 };
      bucket.total += 1;
      byDay.set(session.date, bucket);
    }
    const scheduledIds = new Set(scheduledSessions.map(session => session.id));
    for (const r of allRecords) {
      const day = istDayKey(r.marked_at);
      const bucket = byDay.get(day) || { present: 0, late: 0, absent: 0, total: 0 };
      if (!r.session_id || !scheduledIds.has(r.session_id)) bucket.total += 1;
      if (r.status === 'PRESENT') bucket.present += 1;
      if (r.status === 'LATE') bucket.late += 1;
      byDay.set(day, bucket);
    }

    for (const bucket of byDay.values()) {
      bucket.absent = Math.max(0, bucket.total - bucket.present - bucket.late);
    }

    const daySeries = [...byDay.entries()]
      .map(([date, b]) => ({ date, ...b }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Per-course breakdown
    const byCourse = new Map<string, { title: string; present: number; late: number; total: number }>();
    for (const r of allRecords) {
      const session = r.session as any;
      if (!session?.batches?.programmes) continue;
      const courseTitle = session.batches.programmes.title || 'Unknown';
      const courseKey = session.batches.programme_id || courseTitle;
      const bucket = byCourse.get(courseKey) || { title: courseTitle, present: 0, late: 0, total: 0 };
      bucket.total += 1;
      if (r.status === 'PRESENT') bucket.present += 1;
      if (r.status === 'LATE') bucket.late += 1;
      byCourse.set(courseKey, bucket);
    }

    const courseBreakdown = [...byCourse.entries()]
      .map(([id, b]) => ({
        courseId: id,
        courseTitle: b.title,
        present: b.present,
        late: b.late,
        total: b.total,
        pct: b.total > 0 ? Math.round(((b.present + b.late) / b.total) * 100) : 0,
      }))
      .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));

    // Overall stats
    const totalRecords = [...byDay.values()].reduce((sum, bucket) => sum + bucket.total, 0);
    const presentCount = allRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const overallPct = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : null;

    // Streak — consecutive days with at least one PRESENT/LATE
    const sortedDays = [...byDay.entries()]
      .filter(([, b]) => b.present > 0 || b.late > 0)
      .map(([d]) => d)
      .sort()
      .reverse();

    let streak = 0;
    const todayKey = istDayKey(new Date());
    let checkDate = todayKey;
    for (const day of sortedDays) {
      if (day === checkDate) {
        streak += 1;
        // Move to previous day
        const prev = new Date(`${checkDate}T00:00:00+05:30`);
        prev.setDate(prev.getDate() - 1);
        checkDate = istDayKey(prev);
      } else if (day < checkDate) {
        break;
      }
    }

    // Recent feed (latest 10)
    const recentFeed = allRecords.slice(0, 10).map((r: any) => ({
      id: r.id,
      method: r.method,
      status: r.status,
      markedAt: r.marked_at,
      source: r.source,
      sessionType: (r.session as any)?.session_type ?? null,
      batchName: (r.session as any)?.batches?.name ?? null,
    }));
    const absentDays = daySeries.filter(day => day.absent > 0).map(day => ({ date: day.date, absent: day.absent }));
    const lastPerfectDay = [...daySeries].reverse().find(day => day.total > 0 && day.absent === 0)?.date ?? null;

    return ok({
      member: {
        id: member.id,
        name: (member as any).profiles?.full_name ?? 'Unknown',
        avatar: (member as any).profiles?.avatar_url ?? null,
        email: (member as any).profiles?.email ?? null,
      },
      stats: {
        totalRecords,
        presentCount,
        overallPct,
        streak,
        daysTracked: byDay.size,
        absentCount: Math.max(0, totalRecords - presentCount),
        lastPerfectDay,
      },
      daySeries,
      courseBreakdown,
      absentDays,
      recentFeed,
    });
  });
}
