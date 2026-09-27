import { traineeCreate } from '@/lib/validation/training';
import { NextRequest, NextResponse } from 'next/server';
import { legacyError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { TraineeService } from '@/services/trainee.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const supabase = await createClient();
    const svc = new TraineeService(supabase, membership.organizationId);
    const [trainees, stats] = await Promise.all([
      svc.list({ status, search }),
      svc.getStats(),
    ]);

    return NextResponse.json({ data: { trainees, stats } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = traineeCreate.parse(await request.json());
    const supabase = await createClient();
    const svc = new TraineeService(supabase, membership.organizationId);
    const trainee = await svc.create(body);

    return NextResponse.json({ data: trainee }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
