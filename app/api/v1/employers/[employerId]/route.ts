import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { EmployerService } from '@/services/employer.service';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ employerId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { employerId } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const svc = new EmployerService(supabase, membership.organizationId);
    const employer = await svc.updateEmployer(employerId, body);

    return NextResponse.json({ data: employer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
