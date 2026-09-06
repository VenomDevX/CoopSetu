import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { EnrollmentService, type EnrollmentStatus } from '@/services/enrollment.service';

const VALID: EnrollmentStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'ENROLLED', 'COMPLETED', 'DROPPED'];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { enrollmentId } = await params;
    const supabase = await createClient();
    const svc = new EnrollmentService(supabase, membership.organizationId);
    return NextResponse.json({ data: await svc.getById(enrollmentId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { enrollmentId } = await params;
    const { status, batch_id, remarks } = await request.json();

    if (!status || !VALID.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${VALID.join(', ')}` }, { status: 400 });
    }

    const svc = new EnrollmentService(supabase, membership.organizationId);
    const updated = await svc.transition(enrollmentId, status, auth.user.id, { batch_id, remarks });
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    // Illegal transitions and full batches are client errors.
    const status = /Cannot move|must be assigned|is full/i.test(err.message) ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
