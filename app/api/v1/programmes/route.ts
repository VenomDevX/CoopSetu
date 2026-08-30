import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { ProgrammeService } from '@/services/programme.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const institutionId = searchParams.get('institution_id') || undefined;
    const search = searchParams.get('search') || undefined;

    const supabase = await createClient();
    const svc = new ProgrammeService(supabase, membership.organizationId);
    const [programmes, stats] = await Promise.all([
      svc.list({ status, institutionId, search }),
      svc.getStats(),
    ]);

    return NextResponse.json({ data: { programmes, stats } });
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
    const svc = new ProgrammeService(supabase, membership.organizationId);
    const programme = await svc.create(body);

    return NextResponse.json({ data: programme }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
