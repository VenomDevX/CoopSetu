import { slotCreate } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';
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
    const slots = await svc.listSlots({
      batchId: searchParams.get('batch_id') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    });
    return NextResponse.json({ data: { slots } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = slotCreate.parse(await request.json());
    if (!body.batch_id || !body.title || !body.date || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { error: 'batch_id, title, date, start_time and end_time are required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const svc = new LogisticsService(supabase, membership.organizationId);
    const slot = await svc.createSlot(body);
    return NextResponse.json({ data: slot }, { status: 201 });
  } catch (err: any) {
    // A clash is the planner's to resolve, not a server fault.
    const status = /clashes with/i.test(err.message) ? 409 : 500;
    return legacyError(err, status);
  }
}
