import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { AssessmentService } from '@/services/course.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessmentId } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const svc = new AssessmentService(supabase);
    const question = await svc.addQuestion({ ...body, assessment_id: assessmentId });

    return NextResponse.json({ data: question }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
