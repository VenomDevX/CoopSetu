import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { LmsAnalyticsService } from '@/services/lms-analytics.service';

/**
 * Cohort-level LMS engagement: the timeline, per-module audience, leaderboard.
 *
 * Scoped implicitly through the caller's session — every read goes through
 * their own client, so 0085's institution policies decide what an ICM principal
 * sees versus the NCCT director. No scope parameter is accepted, so it cannot
 * be widened by asking.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 30));

    const supabase = await createClient();
    const svc = new LmsAnalyticsService(supabase, membership.organizationId);

    const [timeline, content, leaderboard] = await Promise.all([
      svc.getEngagementTimeline(days),
      svc.getContentEngagement(),
      svc.getLeaderboard(),
    ]);

    return NextResponse.json({ data: { timeline, content, leaderboard, days } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
