import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { BatchService } from '@/services/batch.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const programmeId = searchParams.get('programme_id') || undefined;

    const supabase = await createClient();
    const svc = new BatchService(supabase);

    const batches = await svc.getBatches(programmeId);

    return NextResponse.json({ data: { batches } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const supabase = await createClient();
    const svc = new BatchService(supabase);

    const batch = await svc.createBatch(body);
    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
