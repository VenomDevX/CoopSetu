import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { EnrollmentService } from '@/services/enrollment.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const programmeId = searchParams.get('programme_id') || undefined;
    const status = searchParams.get('status') || undefined;
    const traineeId = searchParams.get('trainee_id') || undefined;
    const batchId = searchParams.get('batch_id') || undefined;

    const supabase = await createClient();
    const svc = new EnrollmentService(supabase, membership.organizationId);
    const [enrollments, stats] = await Promise.all([
      svc.list({ programmeId, status, traineeId, batchId }),
      svc.getStats(programmeId),
    ]);

    return NextResponse.json({ data: { enrollments, stats } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { trainee_id, programme_id, remarks, source } = body;
    if (!trainee_id || !programme_id) {
      return NextResponse.json({ error: 'trainee_id and programme_id are required' }, { status: 400 });
    }

    const svc = new EnrollmentService(supabase, membership.organizationId);
    // A trainee applying for themselves is a self-registration; anyone else
    // acting on their behalf is a nomination. The distinction is provenance,
    // not permission — RLS decides who may write the row at all.
    const enrollment = source === 'SELF'
      ? await svc.selfRegister({ trainee_id, programme_id, remarks }, auth.user.id)
      : await svc.nominate({ trainee_id, programme_id, remarks }, auth.user.id);

    return NextResponse.json({ data: enrollment }, { status: 201 });
  } catch (err: any) {
    // "already has a ... record" and capacity refusals are the caller's
    // problem to fix, not server faults.
    const status = /already has|is full|required/i.test(err.message) ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
