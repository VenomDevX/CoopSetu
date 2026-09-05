import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { CourseService } from '@/services/course.service';

/**
 * CourseService.addModule() was fully written but had zero callers — no
 * route existed to add a module (with its content_url/content_text) to a
 * course at all. Without this, Phase 8's "download a module for offline"
 * flow has nothing real to download: staff need a way to attach downloadable
 * content to a course through the app, not just via a direct DB insert.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const svc = new CourseService(supabase);
    const courseModule = await svc.addModule({ ...body, course_id: courseId });

    return NextResponse.json({ data: courseModule }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
