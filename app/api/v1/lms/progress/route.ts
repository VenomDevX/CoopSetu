import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { LmsAnalyticsService } from '@/services/lms-analytics.service';

/**
 * One trainee's learning record: progress, grades, streak, achievements and the
 * pace estimate.
 *
 * A trainee always reads their own — trainee_id comes from the session. Staff
 * may pass ?trainee_id= to view someone they supervise, which RLS still gates.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let traineeId = searchParams.get('trainee_id') || undefined;

    if (!traineeId) {
      const { data: self } = await supabase
        .from('trainees').select('id')
        .eq('user_id', auth.user.id)
        .eq('organization_id', membership.organizationId)
        .maybeSingle();
      if (!self) {
        return NextResponse.json(
          { error: 'No trainee record is linked to your account.' },
          { status: 403 },
        );
      }
      traineeId = self.id;
    }

    const svc = new LmsAnalyticsService(supabase, membership.organizationId);
    const [progress, achievements, forecast] = await Promise.all([
      svc.getTraineeProgress(traineeId!),
      svc.listAchievements(traineeId),
      svc.getForecast(traineeId!),
    ]);

    return NextResponse.json({ data: { progress, achievements, forecast } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
