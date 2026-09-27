import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { JobService } from '@/services/employer.service';

/**
 * Candidate search for a job, ranked by skill match.
 *
 * An employer previously had no way to find trainees at all — /dashboard/trainees
 * is not in their nav, the trainee search matches on education/location rather
 * than skills, and the only matching primitive was one trainee at a time.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
    const supabase = await createClient();
    const svc = new JobService(supabase);
    const candidates = await svc.rankCandidatesForJob(jobId, membership.organizationId);

    return NextResponse.json({ data: { candidates } });
  } catch (err: any) {
    return legacyError(err);
  }
}
