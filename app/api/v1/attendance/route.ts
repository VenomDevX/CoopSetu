import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AttendanceService } from '@/services/attendance.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const svc = new AttendanceService(supabase);

    if (body.action === 'create_session') {
      const session = await svc.createSession(body);
      return NextResponse.json({ data: session }, { status: 201 });
    }

    if (body.action === 'mark') {
      const record = await svc.markAttendance(body);
      return NextResponse.json({ data: record }, { status: 201 });
    }

    if (body.action === 'close_session') {
      await svc.closeSession(body.session_id);
      return NextResponse.json({ data: { success: true } });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');
    const traineeId = searchParams.get('trainee_id');
    const sessionId = searchParams.get('session_id');
    const wantRecords = searchParams.get('records');

    const supabase = await createClient();
    const svc = new AttendanceService(supabase);

    // Fetch records for a specific session (used by live feed)
    if (sessionId && wantRecords) {
      const records = await svc.getSessionRecords(sessionId);
      return NextResponse.json({ data: { records } });
    }

    if (batchId) {
      const sessions = await svc.getBatchSessions(batchId);
      const stats = await svc.getAttendanceStats(batchId);
      return NextResponse.json({ data: { sessions, stats } });
    }

    if (traineeId) {
      const records = await svc.getTraineeAttendance(traineeId);
      return NextResponse.json({ data: { records } });
    }

    return NextResponse.json({ error: 'batch_id or trainee_id required' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
