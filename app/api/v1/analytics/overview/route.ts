import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { AttendanceMarksAnalyticsService } from '@/services/attendance-marks-analytics.service';

/**
 * Unified attendance + academic-outcome analytics — one page showing
 * attendance trend, per-course marks, progress and certificates, scoped by
 * who's asking:
 *
 *   - A trainee sees only their own numbers.
 *   - An institute admin (or trainer/employer) sees their own institution's
 *     subtree, exactly like /api/v1/analytics/training scopes institutions:
 *     the institution list is read through the caller's own RLS-bound
 *     session, so a scope cannot be widened by asking.
 *   - A national admin (no institution pin) sees the whole organization, and
 *     may pass ?institution_id= to drill into one — validated against the
 *     same RLS-visible institution list, so it can only narrow, never widen.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = new AttendanceMarksAnalyticsService(supabase, membership.organizationId);

    // Self view: a trainee always sees their own data, regardless of any
    // other role they might also carry.
    const selfTraineeId = membership.roles.includes('TRAINEE')
      ? await svc.traineeIdForUser(auth.user.id)
      : null;

    if (selfTraineeId) {
      const traineeIds = [selfTraineeId];
      const [attendanceTrend, overallAttendancePct, marksByCourse, progress, certificates] = await Promise.all([
        svc.getAttendanceTrend(traineeIds, 90),
        svc.getOverallAttendancePct(traineeIds),
        svc.getMarksByCourse(traineeIds),
        svc.getCourseProgress(traineeIds),
        svc.getCertificateCounts(traineeIds),
      ]);

      return NextResponse.json({
        data: {
          scope: 'SELF',
          overallAttendancePct,
          attendanceTrend,
          marksByCourse,
          progress,
          certificates,
        },
      });
    }

    // Institution-scoped or national view. institutions readable through the
    // caller's own session are exactly the ones 0085's RLS policies allow.
    const { data: visible } = await supabase
      .from('institutions')
      .select('id, name')
      .eq('organization_id', membership.organizationId);
    const visibleInstitutions = visible || [];
    const visibleIds = visibleInstitutions.map((i) => i.id);

    // A caller whose own membership row has institution_id IS NULL is
    // national-scope; everyone else is confined to whatever RLS already
    // returned above, regardless of how many rows that happens to be.
    const callerIsNational = await isNationalCaller(supabase, membership.memberId);

    let institutionIds = visibleIds;
    if (callerIsNational) {
      const requested = request.nextUrl.searchParams.get('institution_id');
      if (requested) {
        if (!visibleIds.includes(requested)) {
          return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
        }
        institutionIds = [requested];
      }
    }

    const traineeIds = await svc.traineeIdsForInstitutions(institutionIds);
    const [attendanceTrend, overallAttendancePct, marksByCourse, progress, certificates] = await Promise.all([
      svc.getAttendanceTrend(traineeIds, 30),
      svc.getOverallAttendancePct(traineeIds),
      svc.getMarksByCourse(traineeIds),
      svc.getCourseProgress(traineeIds),
      svc.getCertificateCounts(traineeIds),
    ]);

    return NextResponse.json({
      data: {
        scope: callerIsNational ? 'NATIONAL' : 'INSTITUTION',
        institutions: callerIsNational ? visibleInstitutions : undefined,
        traineeCount: traineeIds.length,
        overallAttendancePct,
        attendanceTrend,
        marksByCourse,
        progress,
        certificates,
      },
    });
  } catch (err: any) {
    console.error('Analytics overview error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

async function isNationalCaller(supabase: Awaited<ReturnType<typeof createClient>>, memberId: string): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('institution_id')
    .eq('id', memberId)
    .maybeSingle();
  return !data?.institution_id;
}
