import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { EmployerService, JobService } from '@/services/employer.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const employerId = searchParams.get('employer_id') || undefined;

    const supabase = await createClient();
    const jobSvc = new JobService(supabase);
    const [jobs, stats] = await Promise.all([
      jobSvc.listJobs({ status, search, employer_id: employerId }),
      jobSvc.getJobStats(),
    ]);

    return NextResponse.json({ data: { jobs, stats } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const supabase = await createClient();
    const jobSvc = new JobService(supabase);
    const job = await jobSvc.createJob(body);

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
