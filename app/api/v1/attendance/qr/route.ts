import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AttendanceService } from '@/services/attendance.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qr_token, trainee_id } = body;

    if (!qr_token || !trainee_id) {
      return NextResponse.json({ error: 'qr_token and trainee_id required' }, { status: 400 });
    }

    const supabase = await createClient();
    const svc = new AttendanceService(supabase);
    const record = await svc.markAttendanceByQR(qr_token, trainee_id);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
