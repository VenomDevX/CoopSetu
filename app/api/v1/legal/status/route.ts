import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getLegalStatus } from '@/lib/legal/get-legal-status';

export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const status = await getLegalStatus(user, supabase);

    return NextResponse.json({
      data: {
        isAccepted: status.isAccepted,
        termsVersion: status.termsVersion,
        privacyVersion: status.privacyVersion,
        cookiesVersion: status.cookiesVersion,
      },
      error: null,
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } }, { status: 401 });
    }
    console.error('[GET /api/v1/legal/status] Error:', err);
    return NextResponse.json({ data: null, error: { code: 'INTERNAL', message: 'Internal server error' } }, { status: 500 });
  }
}
