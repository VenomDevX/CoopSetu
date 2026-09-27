import { courseCreate } from '@/lib/validation/training';
import { NextRequest, NextResponse } from 'next/server';
import { legacyError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { CourseService } from '@/services/course.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const programmeId = searchParams.get('programme_id') || undefined;

    const supabase = await createClient();
    const svc = new CourseService(supabase);
    const courses = await svc.list(programmeId);

    return NextResponse.json({ data: { courses } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = courseCreate.parse(await request.json());
    const supabase = await createClient();
    const svc = new CourseService(supabase);
    const course = await svc.create(body);

    return NextResponse.json({ data: course }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
