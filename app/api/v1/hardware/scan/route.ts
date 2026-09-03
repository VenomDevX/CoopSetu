import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AttendanceService } from '@/services/attendance.service';

/**
 * HARDWARE SCAN API
 * This endpoint is meant to be called by your custom hardware device
 * after it scans a trainee's dynamic QR code.
 *
 * Expected payload: { "scanned_text": "coopsetu:TRAINEE_ID:TOTP_CODE" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scanned_text } = body;

    if (!scanned_text || typeof scanned_text !== 'string') {
      return NextResponse.json({ error: 'scanned_text is required' }, { status: 400 });
    }

    // Expected format: coopsetu:TRAINEE_ID:TOTP_CODE
    const parts = scanned_text.split(':');
    if (parts.length !== 3 || parts[0] !== 'coopsetu') {
      return NextResponse.json({ error: 'Invalid QR code format' }, { status: 400 });
    }

    const traineeId = parts[1];
    const totpCode = parts[2];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );
    const svc = new AttendanceService(supabase as any);

    // Verify TOTP and mark attendance for active session
    const record = await svc.verifyHardwareTotpAndMark(traineeId, totpCode);

    return NextResponse.json({ 
      data: { 
        success: true, 
        message: 'Attendance marked successfully via hardware',
        record 
      } 
    });

  } catch (err: any) {
    const status = err.message.includes('No active') || err.message.includes('Invalid') || err.message.includes('not currently assigned') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
