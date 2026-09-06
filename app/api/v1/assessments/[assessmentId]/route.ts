import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { getContentLocale } from '@/lib/i18n/content-locale';
import { AssessmentService } from '@/services/course.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessmentId } = await params;
    const supabase = await createClient();
    const svc = new AssessmentService(supabase);
    const assessment = await svc.getById(assessmentId, await getContentLocale());

    // svc.getById() embeds assessment_questions(*), which includes
    // correct_answer. RLS grants org-wide SELECT on assessment_questions (the
    // same convention used for certificates/skills — see migration 0080), so
    // it doesn't distinguish "about to take the quiz" from "allowed to grade
    // it". Strip answers here for anyone without assessment:manage so taking
    // a quiz through this route doesn't hand the trainee the answer key.
    const canManage = membership.permissions.includes('assessment:manage');
    const sanitized = canManage ? assessment : {
      ...assessment,
      assessment_questions: (assessment.assessment_questions ?? []).map(
        ({ correct_answer, ...q }: any) => q,
      ),
    };

    return NextResponse.json({ data: sanitized });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
