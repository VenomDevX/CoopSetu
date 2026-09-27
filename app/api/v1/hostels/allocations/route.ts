import { allocationCreate, allocationCheckOut } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { LogisticsService } from '@/services/logistics.service';

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = allocationCreate.parse(await request.json());
    if (!body.hostel_id || !body.trainee_id) {
      return NextResponse.json({ error: 'hostel_id and trainee_id are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const svc = new LogisticsService(supabase, membership.organizationId);
    return NextResponse.json({ data: await svc.allocate(body) }, { status: 201 });
  } catch (err: any) {
    const status = /is full|already has an active/i.test(err.message) ? 409 : 500;
    return legacyError(err, status);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { allocation_id } = allocationCheckOut.parse(await request.json());

    const supabase = await createClient();
    const svc = new LogisticsService(supabase, membership.organizationId);
    return NextResponse.json({ data: await svc.checkOut(allocation_id) });
  } catch (err: any) {
    return legacyError(err);
  }
}
