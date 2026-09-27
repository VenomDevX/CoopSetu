import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { JobService } from '@/services/employer.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
    const supabase = await createClient();
    const svc = new JobService(supabase);
    const applications = await svc.getApplications(jobId);

    return NextResponse.json({ data: { applications } });
  } catch (err: any) {
    return legacyError(err);
  }
}
