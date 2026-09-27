import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { TrainingAnalyticsService } from '@/services/training-analytics.service';

/**
 * Training analytics — funnel, attendance trend, drop-out risk, institute
 * rollup and geographic spread.
 *
 * Scoping is implicit rather than a parameter: the institution list is read
 * through the caller's own session, so 0085's policies decide what they can
 * see. A national admin (no institution_id) reads every institute; an ICM
 * principal reads their own subtree. Nothing here takes an institution filter
 * from the client, so a scope cannot be widened by asking.
 */
export async function GET(_request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createClient();

    const { data: visible } = await supabase
      .from('institutions')
      .select('id')
      .eq('organization_id', membership.organizationId);
    const institutionIds = (visible || []).map((i) => i.id);

    const svc = new TrainingAnalyticsService(supabase, membership.organizationId);
    const [funnel, attendanceTrend, dropoutRisk, institutions, geography] = await Promise.all([
      svc.getFunnel(institutionIds),
      svc.getAttendanceTrend(30, institutionIds),
      svc.getDropoutRisk(institutionIds),
      svc.getInstitutionRollup(),
      svc.getGeographicSpread(),
    ]);

    return NextResponse.json({
      data: { funnel, attendanceTrend, dropoutRisk, institutions, geography },
    });
  } catch (err: any) {
    return legacyError(err);
  }
}
