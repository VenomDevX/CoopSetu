import { programmeUpdate } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { ProgrammeService } from '@/services/programme.service';

/**
 * Records could be created but never corrected: the services have carried
 * update() and delete() since 0071 with no HTTP route reaching them, so a typo
 * in a trainee's name or a wrongly-registered institute was permanent.
 *
 * Scoping is the service's job — it filters by organization_id — and 0085's
 * policies narrow it further by institute.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = await createClient();
    const svc = new ProgrammeService(supabase, membership.organizationId);
    return NextResponse.json({ data: await svc.getById(id) });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = programmeUpdate.parse(await request.json());
    // The schema whitelists editable fields; identity columns never pass.
    const patch = body;

    const supabase = await createClient();
    const svc = new ProgrammeService(supabase, membership.organizationId);
    return NextResponse.json({ data: await svc.update(id, patch) });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = await createClient();
    const svc = new ProgrammeService(supabase, membership.organizationId);
    await svc.delete(id);
    return NextResponse.json({ data: { success: true } });
  } catch (err: any) {
    return legacyError(err);
  }
}
