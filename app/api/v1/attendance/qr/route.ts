import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { AttendanceService } from '@/services/attendance.service';
import { authenticateDevice } from '@/lib/auth/device-auth';

/**
 * Two callers, two credentials.
 *
 *  - An attendance terminal presents a device bearer token (0088). It has no
 *    cookie session, which is why the ESP32 firmware could not use this route
 *    at all before. It supplies trainee_id, because it just scanned that
 *    trainee's card or recognised their face.
 *  - A signed-in user scans the session QR in a browser. trainee_id is then
 *    resolved from their own session and never read from the body — otherwise
 *    anyone holding a session QR could mark anyone else present.
 *
 * Previously this route made no authentication call of any kind.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate before touching the body, so a caller with no credential
    // never reaches request parsing.
    const device = await authenticateDevice(request);

    const body = await request.json();
    const { qr_token } = body;
    if (!qr_token) {
      return NextResponse.json({ error: 'qr_token required' }, { status: 400 });
    }

    let supabase;
    let traineeId: string;

    if (device) {
      if (!body.trainee_id) {
        return NextResponse.json({ error: 'trainee_id required' }, { status: 400 });
      }
      traineeId = body.trainee_id;
      supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
      ) as never;
    } else {
      const membership = await getCurrentMembership();
      if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { data: trainee } = await supabase
        .from('trainees')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('organization_id', membership.organizationId)
        .maybeSingle();

      if (!trainee) {
        return NextResponse.json(
          { error: 'Only a trainee can check themselves in. Use a terminal to mark others.' },
          { status: 403 },
        );
      }
      traineeId = trainee.id;
    }

    const svc = new AttendanceService(supabase as never);
    const record = await svc.markAttendanceByQR(qr_token, traineeId);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
