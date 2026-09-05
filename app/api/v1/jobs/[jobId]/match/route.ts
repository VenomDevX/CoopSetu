import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { getAuthContext } from '@/lib/auth/require-user';
import { SkillService } from '@/services/skill.service';

/**
 * GET /api/v1/jobs/[jobId]/match?trainee_id=<id>
 *
 * trainee_id is optional and defaults to the caller's own trainee row. This
 * is the same trainee-identity decision as the apply route, extended to
 * reads: /api/v1/skills?trainee_id= trusts a client-supplied trainee_id with
 * no ownership check at all, relying only on RLS's org-wide SELECT (the same
 * convention certificates/skills already use). That's not repeated here.
 * Instead: a caller who is themselves a trainee may only ever request their
 * own match score — trainee-to-trainee snooping on another applicant's
 * standing for a job is rejected before hitting the database. A caller with
 * no trainees row of their own (staff: EMPLOYER/TRAINER/INSTITUTE_ADMIN/
 * ADMIN reviewing applicants) may request any trainee_id; RLS still enforces
 * that the target trainee is in the caller's own organization.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
    const { user, supabase } = await getAuthContext();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: ownTrainee, error: ownTraineeError } = await supabase
      .from('trainees')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (ownTraineeError) throw ownTraineeError;

    const { searchParams } = new URL(request.url);
    const requestedTraineeId = searchParams.get('trainee_id') || undefined;

    let traineeId: string;
    if (!requestedTraineeId || requestedTraineeId === ownTrainee?.id) {
      if (!ownTrainee) {
        return NextResponse.json({ error: 'trainee_id is required.' }, { status: 400 });
      }
      traineeId = ownTrainee.id;
    } else if (ownTrainee) {
      // The caller has their own trainees row but asked about someone else's.
      return NextResponse.json({ error: "You cannot view another trainee's match score." }, { status: 403 });
    } else {
      traineeId = requestedTraineeId;
    }

    const svc = new SkillService(supabase);
    const [matchScore, gapAnalysis] = await Promise.all([
      svc.calculateJobMatchScore(traineeId, jobId),
      svc.getSkillGapAnalysis(traineeId, jobId),
    ]);

    return NextResponse.json({ data: { matchScore, gapAnalysis } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
