import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CertificateService } from '@/services/certificate.service';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';

export async function GET() {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const svc = new CertificateService(supabase);
    const [certificates, stats] = await Promise.all([
      svc.listAll(membership.organizationId),
      svc.getStats(membership.organizationId),
    ]);

    return NextResponse.json({ data: { certificates, stats } });
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
    const svc = new CertificateService(supabase);
    const certificate = await svc.issue(body);

    return NextResponse.json({ data: certificate }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
