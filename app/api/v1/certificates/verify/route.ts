import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CertificateService } from '@/services/certificate.service';

// Public endpoint — no auth required for certificate verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const certNumber = searchParams.get('cert_number') || searchParams.get('id');

    if (!certNumber) {
      return NextResponse.json({ error: 'cert_number parameter required' }, { status: 400 });
    }

    const supabase = await createClient();
    const svc = new CertificateService(supabase);
    const result = await svc.verify(certNumber);

    return NextResponse.json({ data: result });
  } catch (err: any) {
    return legacyError(err);
  }
}
