import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { LogisticsService } from '@/services/logistics.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const supabase = await createClient();
    const svc = new LogisticsService(supabase, membership.organizationId);
    const [hostels, allocations, mess] = await Promise.all([
      svc.listHostels(searchParams.get('institution_id') || undefined),
      svc.listAllocations(searchParams.get('hostel_id') || undefined),
      svc.getMessSummary(),
    ]);
    return NextResponse.json({ data: { hostels, allocations, mess } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const supabase = await createClient();
    const svc = new LogisticsService(supabase, membership.organizationId);
    return NextResponse.json({ data: await svc.createHostel(body) }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
