import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AttendanceService } from '@/services/attendance.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, trainee_id, session_id, embedding } = body;

    if (!action || !trainee_id) {
      return NextResponse.json({ error: 'action and trainee_id required' }, { status: 400 });
    }

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json({ error: 'Face embedding data required' }, { status: 400 });
    }

    const supabase = await createClient();
    const svc = new AttendanceService(supabase);

    if (action === 'register') {
      // Store the face embedding for the trainee
      await svc.registerFaceEmbedding(trainee_id, embedding);
      return NextResponse.json({ data: { success: true, message: 'Face registered successfully' } }, { status: 201 });
    }

    if (action === 'verify') {
      if (!session_id) {
        return NextResponse.json({ error: 'session_id required for verification' }, { status: 400 });
      }

      // Verify face and mark attendance
      const result = await svc.verifyFaceAndMarkAttendance(trainee_id, session_id, embedding);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: 'Invalid action. Use "register" or "verify".' }, { status: 400 });
  } catch (err: any) {
    // A malformed embedding is the caller's mistake, not a server fault. It
    // previously returned 500, which told a client to retry something that
    // could never succeed.
    const status = /not registered|No face|Invalid face embedding|required/i.test(err.message) ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
