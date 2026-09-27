import { assessmentCreate } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { AssessmentService } from '@/services/course.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id') || undefined;

    const supabase = await createClient();
    const svc = new AssessmentService(supabase);
    const assessments = await svc.list(courseId);

    return NextResponse.json({ data: { assessments } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = assessmentCreate.parse(await request.json());
    const supabase = await createClient();
    const svc = new AssessmentService(supabase);
    const assessment = await svc.create(body);

    return NextResponse.json({ data: assessment }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
