import { jobUpdate } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { JobService } from '@/services/employer.service';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
    const body = jobUpdate.parse(await request.json());
    const supabase = await createClient();
    const svc = new JobService(supabase);
    const job = await svc.updateJob(jobId, body);

    return NextResponse.json({ data: job });
  } catch (err: any) {
    return legacyError(err);
  }
}
