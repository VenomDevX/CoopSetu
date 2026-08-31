import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TrainerService } from '@/services/trainer.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get('institution_id') || undefined;

    const supabase = await createClient();
    const svc = new TrainerService(supabase);
    
    const trainers = await svc.getTrainers(institutionId);
    
    return NextResponse.json({ data: { trainers } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const svc = new TrainerService(supabase);

    const trainer = await svc.createTrainer(body);
    return NextResponse.json({ data: trainer }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
