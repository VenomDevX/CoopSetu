import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AttendanceService } from '@/services/attendance.service';

/**
 * TOTP Secret API
 * Generates or retrieves the TOTP secret for the logged-in user.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = new AttendanceService(supabase);
    // getOrGenerateTotpSecret now creates/fetches from the 'profiles' table
    const secret = await svc.getOrGenerateTotpSecret(user.id);

    return NextResponse.json({ data: { secret, userId: user.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
