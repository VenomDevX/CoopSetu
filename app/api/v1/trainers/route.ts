import { trainerCreate } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { TrainerService } from '@/services/trainer.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get('institution_id') || undefined;

    const supabase = await createClient();
    const svc = new TrainerService(supabase);

    const trainers = await svc.getTrainers(institutionId);

    return NextResponse.json({ data: { trainers } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = trainerCreate.parse(await request.json());
    const supabase = await createClient();
    const svc = new TrainerService(supabase);

    const trainer = await svc.createTrainer(body);
    return NextResponse.json({ data: trainer }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
