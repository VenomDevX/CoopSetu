import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { getAuthContext } from '@/lib/auth/require-user';
import { AssessmentService } from '@/services/course.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessmentId } = await params;
    const supabase = await createClient();
    const svc = new AssessmentService(supabase);
    const results = await svc.getResults(assessmentId);

    return NextResponse.json({ data: { results } });
  } catch (err: any) {
    return legacyError(err);
  }
}

/**
 * A trainee submits their own attempt. Two things are deliberately never
 * trusted from the client, matching this plan's trainee-identity decision and
 * its extension to grading:
 *
 *  - trainee_id: resolved server-side from the caller's own session, exactly
 *    like POST /api/v1/jobs/[jobId]/apply — a trainee can only ever submit
 *    for themselves.
 *  - score: computed server-side from the real assessment_questions.
 *    correct_answer, not accepted from the request body. AssessmentService.
 *    submitResult() takes a score argument because it's also used by staff
 *    grading tools, but this trainee-facing route is the only caller today
 *    and it always supplies a score it calculated itself.
 *
 * Only MCQ/TRUE_FALSE questions are auto-graded; SHORT_ANSWER/ESSAY answers
 * are recorded but scored 0 here (manual grading is out of scope for this
 * phase — a known limitation, not silently wrong: those questions simply
 * don't contribute marks yet).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessmentId } = await params;
    const { user, supabase } = await getAuthContext();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trainee, error: traineeError } = await supabase
      .from('trainees')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (traineeError) throw traineeError;
    if (!trainee) {
      return NextResponse.json({ error: 'Only trainees can submit assessment attempts.' }, { status: 403 });
    }

    const svc = new AssessmentService(supabase);
    const assessment = await svc.getById(assessmentId);

    const priorAttempts = await svc.countAttempts(assessmentId, trainee.id);
    const attemptNumber = priorAttempts + 1;
    if (assessment.attempts_allowed && attemptNumber > assessment.attempts_allowed) {
      return NextResponse.json({ error: 'No attempts remaining for this assessment.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const answers: Record<string, string> = body.answers ?? {};
    const score = svc.gradeAnswers(assessment.assessment_questions ?? [], answers);

    const result = await svc.submitResult({
      assessment_id: assessmentId,
      trainee_id: trainee.id,
      score,
      max_score: assessment.max_score,
      answers,
      attempt_number: attemptNumber,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
