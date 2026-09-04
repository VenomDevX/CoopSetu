import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillService } from '@/services/skill.service';
import type { SupabaseClient } from '@supabase/supabase-js';

function mockSupabaseFor(jobSkills: any[], traineeSkills: any[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'job_skills') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: jobSkills, error: null })) })) };
      }
      if (table === 'trainee_skills') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: traineeSkills, error: null })) })) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as SupabaseClient;
}

describe('SkillService job-matching (previously zero-caller)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateJobMatchScore() returns 50 (average) when the job has no required skills', async () => {
    const svc = new SkillService(mockSupabaseFor([], []));
    const score = await svc.calculateJobMatchScore('t1', 'j1');
    expect(score).toBe(50);
  });

  it('calculateJobMatchScore() returns 100 when the trainee fully covers every required skill', async () => {
    const jobSkills = [{ skill_id: 's1', importance: 'REQUIRED' }, { skill_id: 's2', importance: 'PREFERRED' }];
    const traineeSkills = [{ skill_id: 's1', proficiency: 100 }, { skill_id: 's2', proficiency: 100 }];
    const svc = new SkillService(mockSupabaseFor(jobSkills, traineeSkills));
    const score = await svc.calculateJobMatchScore('t1', 'j1');
    expect(score).toBe(100);
  });

  it('calculateJobMatchScore() returns 0 when the trainee has none of the required skills', async () => {
    const jobSkills = [{ skill_id: 's1', importance: 'REQUIRED' }];
    const svc = new SkillService(mockSupabaseFor(jobSkills, []));
    const score = await svc.calculateJobMatchScore('t1', 'j1');
    expect(score).toBe(0);
  });

  it('calculateJobMatchScore() weights REQUIRED skills more heavily than PREFERRED/NICE_TO_HAVE', async () => {
    const jobSkills = [{ skill_id: 's1', importance: 'REQUIRED' }, { skill_id: 's2', importance: 'NICE_TO_HAVE' }];
    // Trainee has the nice-to-have skill fully, but is missing the required one.
    const traineeSkills = [{ skill_id: 's2', proficiency: 100 }];
    const svc = new SkillService(mockSupabaseFor(jobSkills, traineeSkills));
    const score = await svc.calculateJobMatchScore('t1', 'j1');
    // weight: required=3, nice_to_have=1 -> total 4, matched 1 -> 25%
    expect(score).toBe(25);
  });

  it('getSkillGapAnalysis() buckets skills into matched/partial/missing', async () => {
    const jobSkills = [
      { skill_id: 's1', importance: 'REQUIRED', skills: { name: 'SQL', category: 'Data' } },
      { skill_id: 's2', importance: 'PREFERRED', skills: { name: 'Python', category: 'Data' } },
      { skill_id: 's3', importance: 'REQUIRED', skills: { name: 'React', category: 'Web' } },
    ];
    const traineeSkills = [{ skill_id: 's1', proficiency: 90 }, { skill_id: 's2', proficiency: 40 }];
    const svc = new SkillService(mockSupabaseFor(jobSkills, traineeSkills));
    const analysis = await svc.getSkillGapAnalysis('t1', 'j1');

    expect(analysis.matched).toEqual([{ name: 'SQL', proficiency: 90 }]);
    expect(analysis.partial).toEqual([{ name: 'Python', proficiency: 40, importance: 'PREFERRED' }]);
    expect(analysis.missing).toEqual([{ name: 'React', importance: 'REQUIRED' }]);
  });
});
