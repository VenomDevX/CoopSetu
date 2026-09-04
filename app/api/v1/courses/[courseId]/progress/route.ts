import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { getAuthContext } from '@/lib/auth/require-user';
import { CourseService } from '@/services/course.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await params;
    const { user, supabase } = await getAuthContext();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trainee, error: traineeError } = await supabase
      .from('trainees')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (traineeError) throw traineeError;
    if (!trainee) return NextResponse.json({ error: 'Only trainees have course progress.' }, { status: 403 });

    const svc = new CourseService(supabase);
    const progress = await svc.getProgress(trainee.id, courseId);

    return NextResponse.json({ data: { progress } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * A trainee records their own progress on a module — used both for the
 * normal online path and by lib/offline/sync.ts flushing a queued offline
 * module view. trainee_id is never accepted from the client: resolved
 * server-side from the caller's own session, matching every other
 * trainee-facing write in this codebase (see POST /api/v1/jobs/[jobId]/apply).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await params;
    const { user, supabase } = await getAuthContext();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trainee, error: traineeError } = await supabase
      .from('trainees')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (traineeError) throw traineeError;
    if (!trainee) return NextResponse.json({ error: 'Only trainees have course progress.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (!body.module_id) return NextResponse.json({ error: 'module_id is required.' }, { status: 400 });
    const progressPct = Number(body.progress_pct);
    if (!Number.isFinite(progressPct) || progressPct < 0 || progressPct > 100) {
      return NextResponse.json({ error: 'progress_pct must be a number between 0 and 100.' }, { status: 400 });
    }

    const svc = new CourseService(supabase);
    const progress = await svc.updateProgress(trainee.id, courseId, body.module_id, progressPct);

    return NextResponse.json({ data: progress }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
