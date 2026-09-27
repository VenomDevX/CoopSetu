import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { LogisticsService } from '@/services/logistics.service';

/** Publishing a slot creates the attendance session it will be marked against. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ slotId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { slotId } = await params;
    const supabase = await createClient();
    const svc = new LogisticsService(supabase, membership.organizationId);
    return NextResponse.json({ data: await svc.publishSlot(slotId) });
  } catch (err: any) {
    const status = /cannot be published/i.test(err.message) ? 400 : 500;
    return legacyError(err, status);
  }
}
