import { SupabaseClient } from '@supabase/supabase-js';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
}

export interface TraineeSkillProfile {
  trainee_id: string;
  skills: {
    skill_id: string;
    name: string;
    category: string;
    proficiency: number;
    verified: boolean;
    source: string;
  }[];
  certificates: number;
  coursesCompleted: number;
  employmentReadiness: number;
}

export class SkillService {
  constructor(private supabase: SupabaseClient) {}

  async listSkills(category?: string) {
    let q = this.supabase.from('skills').select('*').order('name');
    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    if (error) throw error;
    return data as Skill[];
  }

  async createSkill(input: { name: string; category: string; description?: string }) {
    const { data, error } = await this.supabase
      .from('skills')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Skill;
  }

  async addTraineeSkill(input: { trainee_id: string; skill_id: string; proficiency?: number; source?: string }) {
    const { data, error } = await this.supabase
      .from('trainee_skills')
      .upsert({
        trainee_id: input.trainee_id,
        skill_id: input.skill_id,
        proficiency: input.proficiency || 0,
        source: input.source || 'SELF_DECLARED',
      }, { onConflict: 'trainee_id,skill_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getTraineeSkillProfile(traineeId: string): Promise<TraineeSkillProfile> {
    const [skillsRes, certsRes, progressRes] = await Promise.all([
      this.supabase.from('trainee_skills').select('*, skills(name, category)').eq('trainee_id', traineeId),
      this.supabase.from('certificates').select('id').eq('trainee_id', traineeId).eq('status', 'ACTIVE'),
      this.supabase.from('course_progress').select('id').eq('trainee_id', traineeId).eq('completed', true),
    ]);

    if (skillsRes.error) throw skillsRes.error;
    if (certsRes.error) throw certsRes.error;
    if (progressRes.error) throw progressRes.error;

    const skills = (skillsRes.data || []).map((ts: any) => ({
      skill_id: ts.skill_id,
      name: ts.skills?.name || '',
      category: ts.skills?.category || '',
      proficiency: ts.proficiency,
      verified: ts.verified,
      source: ts.source,
    }));

    const certificates = certsRes.data?.length || 0;
    const coursesCompleted = progressRes.data?.length || 0;

    // Calculate employment readiness from average proficiency + certificates + courses
    const avgProficiency = skills.length > 0 ? skills.reduce((sum: number, s: { proficiency: number }) => sum + s.proficiency, 0) / skills.length : 0;
    const certBonus = Math.min(certificates * 5, 20);
    const courseBonus = Math.min(coursesCompleted * 3, 15);
    const employmentReadiness = Math.min(Math.round(avgProficiency * 0.65 + certBonus + courseBonus), 100);

    return {
      trainee_id: traineeId,
      skills,
      certificates,
      coursesCompleted,
      employmentReadiness,
    };
  }

  async calculateJobMatchScore(traineeId: string, jobId: string): Promise<number> {
    // Get job required skills
    const { data: jobSkills, error: jsErr } = await this.supabase
      .from('job_skills')
      .select('skill_id, importance')
      .eq('job_id', jobId);
    if (jsErr) throw jsErr;

    if (!jobSkills || jobSkills.length === 0) return 50; // No skills required = average match

    // Get trainee skills
    const { data: traineeSkills, error: tsErr } = await this.supabase
      .from('trainee_skills')
      .select('skill_id, proficiency')
      .eq('trainee_id', traineeId);
    if (tsErr) throw tsErr;

    const traineeSkillMap = new Map((traineeSkills || []).map(s => [s.skill_id, s.proficiency]));

    let totalWeight = 0;
    let matchedWeight = 0;

    for (const js of jobSkills) {
      const weight = js.importance === 'REQUIRED' ? 3 : js.importance === 'PREFERRED' ? 2 : 1;
      totalWeight += weight;
      const proficiency = traineeSkillMap.get(js.skill_id);
      if (proficiency !== undefined) {
        matchedWeight += weight * (proficiency / 100);
      }
    }

    return totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  }

  async getSkillGapAnalysis(traineeId: string, jobId: string) {
    const { data: jobSkills, error: jsErr } = await this.supabase
      .from('job_skills')
      .select('skill_id, importance, skills(name, category)')
      .eq('job_id', jobId);
    if (jsErr) throw jsErr;

    const { data: traineeSkills, error: tsErr } = await this.supabase
      .from('trainee_skills')
      .select('skill_id, proficiency')
      .eq('trainee_id', traineeId);
    if (tsErr) throw tsErr;

    const traineeSkillMap = new Map((traineeSkills || []).map(s => [s.skill_id, s.proficiency]));

    const analysis = {
      matched: [] as { name: string; proficiency: number }[],
      missing: [] as { name: string; importance: string }[],
      partial: [] as { name: string; proficiency: number; importance: string }[],
    };

    for (const js of jobSkills || []) {
      const skillName = (js.skills as any)?.name || 'Unknown';
      const proficiency = traineeSkillMap.get(js.skill_id);
      
      if (proficiency === undefined || proficiency === 0) {
        analysis.missing.push({ name: skillName, importance: js.importance });
      } else if (proficiency >= 70) {
        analysis.matched.push({ name: skillName, proficiency });
      } else {
        analysis.partial.push({ name: skillName, proficiency, importance: js.importance });
      }
    }

    return analysis;
  }
}
