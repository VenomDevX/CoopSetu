import { skillCreate, traineeSkillAdd } from '@/lib/validation/training';
import { NextRequest, NextResponse } from 'next/server';
import { legacyError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { SkillService } from '@/services/skill.service';

export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const traineeId = searchParams.get('trainee_id') || undefined;

    const supabase = await createClient();
    const svc = new SkillService(supabase);

    if (traineeId) {
      const profile = await svc.getTraineeSkillProfile(traineeId);
      return NextResponse.json({ data: { profile } });
    }

    const skills = await svc.listSkills(category);
    return NextResponse.json({ data: { skills } });
  } catch (err: any) {
    return legacyError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const supabase = await createClient();
    const svc = new SkillService(supabase);

    if (body.trainee_id && body.skill_id) {
      const result = await svc.addTraineeSkill(traineeSkillAdd.parse(body));
      return NextResponse.json({ data: result }, { status: 201 });
    }

    const skill = await svc.createSkill(skillCreate.parse(body));
    return NextResponse.json({ data: skill }, { status: 201 });
  } catch (err: any) {
    return legacyError(err);
  }
}
