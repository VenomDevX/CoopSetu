import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { LmsAnalyticsService } from '@/services/lms-analytics.service';

const ALLOWED = new Set([
  'VIEW_START', 'VIEW_PROGRESS', 'MODULE_COMPLETE', 'COURSE_COMPLETE',
  'ASSESSMENT_SUBMIT', 'CERTIFICATE_EARNED', 'DOWNLOAD',
]);

/**
 * Records one learning event.
 *
 * trainee_id is resolved from the session and never read from the body — an
 * event log whose subject the client can choose is worthless as evidence, and
 * would let anyone inflate someone else's streak.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trainee } = await supabase
      .from('trainees').select('id')
      .eq('user_id', auth.user.id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (!trainee) {
      return NextResponse.json({ error: 'Only trainees generate learning events.' }, { status: 403 });
    }

    const body = await request.json();
    if (!ALLOWED.has(body.event_type)) {
      return NextResponse.json(
        { error: `event_type must be one of ${[...ALLOWED].join(', ')}` },
        { status: 400 },
      );
    }

    const svc = new LmsAnalyticsService(supabase, membership.organizationId);
    await svc.recordEvent({
      traineeId: trainee.id,
      eventType: body.event_type,
      courseId: body.course_id,
      moduleId: body.module_id,
      assessmentId: body.assessment_id,
      progressPct: body.progress_pct,
      secondsSpent: body.seconds_spent,
      metadata: body.metadata,
    });

    // Awarding here rather than on a schedule means a badge appears in the same
    // response as the action that earned it.
    const unlocked = await svc.evaluateAchievements(trainee.id);

    return NextResponse.json({ data: { recorded: true, unlocked } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
