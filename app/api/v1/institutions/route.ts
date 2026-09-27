import { institutionCreate } from '@/lib/validation/training';
import { NextRequest, NextResponse } from 'next/server';
import { legacyError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { InstitutionService } from '@/services/institution.service';

export async function GET() {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const svc = new InstitutionService(supabase, membership.organizationId);
    const [institutions, stats] = await Promise.all([svc.list(), svc.getStats()]);

    return NextResponse.json({ data: { institutions, stats } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = institutionCreate.parse(await request.json());
    const supabase = await createClient();
    const svc = new InstitutionService(supabase, membership.organizationId);
    const institution = await svc.create(body);

    return NextResponse.json({ data: institution }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
