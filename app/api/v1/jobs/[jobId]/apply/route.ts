import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { getAuthContext } from '@/lib/auth/require-user';
import { JobService } from '@/services/employer.service';

/**
 * Trainee applies to a job. The applicant's `trainee_id` is always resolved
 * server-side from the authenticated user — never trusted from the request
 * body — so a caller can never apply on another trainee's behalf. This is
 * the same decision documented for /api/v1/jobs/[jobId]/match: it is the
 * fix for the pattern GET /api/v1/skills?trainee_id= gets wrong today by
 * trusting a client-supplied id with no ownership check.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
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
      return NextResponse.json({ error: 'Only trainees can apply to jobs.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const svc = new JobService(supabase);
    const application = await svc.applyToJob({
      job_id: jobId,
      trainee_id: trainee.id,
      cover_letter: body.cover_letter,
      resume_url: body.resume_url,
    });

    return NextResponse.json({ data: application }, { status: 201 });
  } catch (err: any) {
    const alreadyApplied = err.code === '23505' || /duplicate key|already exists/i.test(err.message || '');
    if (alreadyApplied) {
      return NextResponse.json({ error: 'You have already applied to this job.' }, { status: 409 });
    }
    return legacyError(err);
  }
}
