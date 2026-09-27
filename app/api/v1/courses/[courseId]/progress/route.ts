import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { getAuthContext } from '@/lib/auth/require-user';
import { CourseService } from '@/services/course.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await params;
    const { user, supabase } = await getAuthContext();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trainee, error: traineeError } = await supabase
      .from('trainees')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (traineeError) throw traineeError;
    if (!trainee) return NextResponse.json({ error: 'Only trainees have course progress.' }, { status: 403 });

    const svc = new CourseService(supabase);
    const progress = await svc.getProgress(trainee.id, courseId);

    return NextResponse.json({ data: { progress } });
  } catch (err: any) {
    return legacyError(err);
  }
}

/**
 * A trainee records their own progress on a module — used both for the
 * normal online path and by lib/offline/sync.ts flushing a queued offline
 * module view. trainee_id is never accepted from the client: resolved
 * server-side from the caller's own session, matching every other
 * trainee-facing write in this codebase (see POST /api/v1/jobs/[jobId]/apply).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await params;
    const { user, supabase } = await getAuthContext();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trainee, error: traineeError } = await supabase
      .from('trainees')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (traineeError) throw traineeError;
    if (!trainee) return NextResponse.json({ error: 'Only trainees have course progress.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (!body.module_id) return NextResponse.json({ error: 'module_id is required.' }, { status: 400 });
    const progressPct = Number(body.progress_pct);
    if (!Number.isFinite(progressPct) || progressPct < 0 || progressPct > 100) {
      return NextResponse.json({ error: 'progress_pct must be a number between 0 and 100.' }, { status: 400 });
    }

    const svc = new CourseService(supabase);
    const progress = await svc.updateProgress(trainee.id, courseId, body.module_id, progressPct);

    // Append the history alongside the current-state row. Done here rather than
    // in the player so the log fills in for every caller — including
    // lib/offline/sync.ts replaying a queued offline view.
    const { LmsAnalyticsService } = await import('@/services/lms-analytics.service');
    const lms = new LmsAnalyticsService(supabase, membership.organizationId);

    let unlocked: { code: string; name: string; tier: string; points: number }[] = [];
    try {
      await lms.recordEvent({
        traineeId: trainee.id,
        eventType: progressPct >= 100 ? 'MODULE_COMPLETE' : 'VIEW_PROGRESS',
        courseId,
        moduleId: body.module_id,
        progressPct,
        secondsSpent: Number(body.seconds_spent) || 0,
      });
      // Only on completion: a badge check on every timeupdate would be several
      // queries per second per learner for a result that cannot have changed.
      if (progressPct >= 100) unlocked = await lms.evaluateAchievements(trainee.id);
    } catch {
      // Analytics must never cost a trainee their progress. The write above has
      // already succeeded; losing a log line is the cheaper failure.
    }

    return NextResponse.json({ data: progress, unlocked }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
