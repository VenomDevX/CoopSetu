import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { JobService } from '@/services/employer.service';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string; applicationId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { applicationId } = await params;
    const body = await request.json();
    if (!body.status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

    const supabase = await createClient();
    const svc = new JobService(supabase);
    const application = await svc.updateApplicationStatus(applicationId, body.status);

    return NextResponse.json({ data: application });
  } catch (err: any) {
    return legacyError(err);
  }
}
