import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { getContentLocale } from '@/lib/i18n/content-locale';
import { CourseService } from '@/services/course.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await params;
    const supabase = await createClient();
    const svc = new CourseService(supabase);
    const course = await svc.getById(courseId, await getContentLocale());

    return NextResponse.json({ data: course });
  } catch (err: any) {
    return legacyError(err);
  }
}
