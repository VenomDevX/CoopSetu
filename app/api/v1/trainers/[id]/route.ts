import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { TrainerService } from '@/services/trainer.service';

/**
 * Records could be created but never corrected: the services have carried
 * update() and delete() since 0071 with no HTTP route reaching them, so a typo
 * in a trainee's name or a wrongly-registered institute was permanent.
 *
 * TrainerService predates the orgId-scoped convention and uses verb-suffixed
 * methods, so this route matches it rather than renaming a service other
 * callers depend on. Scoping here comes from 0085's policies.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = await createClient();
    const svc = new TrainerService(supabase);
    return NextResponse.json({ data: await svc.getTrainerById(id) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    // Identity columns are never taken from the body: moving a record between
    // organizations or reassigning its owner is not an edit.
    const { id: _id, organization_id: _org, user_id: _user, created_at: _created, ...patch } = body;

    const supabase = await createClient();
    const svc = new TrainerService(supabase);
    return NextResponse.json({ data: await svc.updateTrainer(id, patch) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = await createClient();
    const svc = new TrainerService(supabase);
    await svc.deleteTrainer(id);
    return NextResponse.json({ data: { success: true } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
