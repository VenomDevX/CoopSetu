import { employerCreate } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { EmployerService } from '@/services/employer.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const supabase = await createClient();
    const svc = new EmployerService(supabase, membership.organizationId);
    const employers = await svc.listEmployers({ status, search });

    return NextResponse.json({ data: { employers } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = employerCreate.parse(await request.json());
    const supabase = await createClient();
    const svc = new EmployerService(supabase, membership.organizationId);
    const employer = await svc.createEmployer(body);

    return NextResponse.json({ data: employer }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
