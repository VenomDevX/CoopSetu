import { SupabaseClient } from '@supabase/supabase-js';

export interface Employer {
  id: string;
  user_id: string;
  organization_id: string;
  company_name: string;
  industry?: string;
  company_size?: string;
  location?: string;
  website?: string;
  description?: string;
  logo_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  employer_id: string;
  title: string;
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  employment_type: string;
  experience_min: number;
  experience_max?: number;
  education_required?: string;
  is_remote: boolean;
  vacancies: number;
  deadline?: string;
  status: string;
  created_at: string;
  updated_at: string;
  employers?: Employer;
  job_skills?: { skills: { name: string; category: string } }[];
}

export interface JobApplication {
  id: string;
  job_id: string;
  trainee_id: string;
  match_score: number;
  status: string;
  cover_letter?: string;
  resume_url?: string;
  applied_at: string;
  updated_at: string;
}

export class EmployerService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  async listEmployers(filters?: { status?: string; search?: string }) {
    let q = this.supabase
      .from('employers')
      .select('*')
      .eq('organization_id', this.orgId)
      .order('company_name');

    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.search) q = q.ilike('company_name', `%${filters.search}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data as Employer[];
  }

  async createEmployer(input: { user_id: string; company_name: string; industry?: string; company_size?: string; location?: string; website?: string; description?: string }) {
    const { data, error } = await this.supabase
      .from('employers')
      .insert({ ...input, organization_id: this.orgId })
      .select()
      .single();
    if (error) throw error;
    return data as Employer;
  }

  async updateEmployer(id: string, input: Partial<Employer>) {
    const { data, error } = await this.supabase
      .from('employers')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Employer;
  }
}

export class JobService {
  constructor(private supabase: SupabaseClient) {}

  async listJobs(filters?: { status?: string; employment_type?: string; search?: string; employer_id?: string }) {
    let q = this.supabase
      .from('jobs')
      .select('*, employers(company_name, location, logo_url), job_skills(skills(name, category))')
      .order('created_at', { ascending: false });

    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.employment_type) q = q.eq('employment_type', filters.employment_type);
    if (filters?.employer_id) q = q.eq('employer_id', filters.employer_id);
    if (filters?.search) q = q.ilike('title', `%${filters.search}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data as Job[];
  }

  async createJob(input: { employer_id: string; title: string; description?: string; location?: string; salary_min?: number; salary_max?: number; employment_type?: string; experience_min?: number; experience_max?: number; education_required?: string; is_remote?: boolean; vacancies?: number; deadline?: string; skill_ids?: string[] }) {
    const { skill_ids, ...jobInput } = input;

    const { data: job, error } = await this.supabase
      .from('jobs')
      .insert(jobInput)
      .select()
      .single();
    if (error) throw error;

    // Link skills to job
    if (skill_ids && skill_ids.length > 0) {
      const { error: skillError } = await this.supabase
        .from('job_skills')
        .insert(skill_ids.map(sid => ({ job_id: job.id, skill_id: sid })));
      if (skillError) throw skillError;
    }

    return job as Job;
  }

  async updateJob(id: string, input: Partial<Job>) {
    const { data, error } = await this.supabase
      .from('jobs')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Job;
  }

  async applyToJob(input: { job_id: string; trainee_id: string; cover_letter?: string; resume_url?: string }) {
    // match_score was declared on the row and ordered by in getApplications(),
    // but never written — it defaults to 0, so the employer's shortlisting view
    // showed "Match: 0%" for every candidate and its ordering was a constant.
    // SkillService.calculateJobMatchScore already existed and was reachable
    // only through GET /jobs/[jobId]/match, one trainee at a time.
    //
    // Computed at apply time rather than on read: it is the score *as of* the
    // application, so a later skill change does not silently rewrite history an
    // employer has already reviewed.
    let matchScore = 0;
    try {
      const { SkillService } = await import('./skill.service');
      matchScore = await new SkillService(this.supabase).calculateJobMatchScore(
        input.trainee_id,
        input.job_id,
      );
    } catch {
      // A job with no skills attached, or a trainee with no skill profile yet,
      // is an ordinary state — not a reason to refuse the application.
    }

    const { data, error } = await this.supabase
      .from('job_applications')
      .insert({ ...input, match_score: matchScore })
      .select()
      .single();
    if (error) throw error;
    return data as JobApplication;
  }

  /**
   * Ranks every trainee against one job — the reverse of
   * calculateJobMatchScore, which answers for a single trainee. This is what an
   * employer actually needs: "who should I talk to", not "how good is this one".
   */
  async rankCandidatesForJob(jobId: string, orgId: string, limit = 25) {
    const { data: trainees, error } = await this.supabase
      .from('trainees')
      .select('id, education, location, employment_status, profiles:user_id(full_name)')
      .eq('organization_id', orgId)
      .eq('status', 'ACTIVE');
    if (error) throw error;

    const { SkillService } = await import('./skill.service');
    const skills = new SkillService(this.supabase);

    const scored = await Promise.all(
      (trainees || []).map(async (t: any) => ({
        ...t,
        match_score: await skills.calculateJobMatchScore(t.id, jobId).catch(() => 0),
      })),
    );

    return scored
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);
  }

  async getApplications(jobId: string) {
    const { data, error } = await this.supabase
      .from('job_applications')
      .select('*, trainees(id, profiles:user_id(full_name, email))')
      .eq('job_id', jobId)
      .order('match_score', { ascending: false });
    if (error) throw error;
    return data;
  }

  async updateApplicationStatus(id: string, status: string) {
    const { data, error } = await this.supabase
      .from('job_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as JobApplication;
  }

  async getJobStats() {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('id, status');
    if (error) throw error;
    const jobs = data || [];
    return {
      total: jobs.length,
      open: jobs.filter(j => j.status === 'OPEN').length,
      closed: jobs.filter(j => j.status === 'CLOSED').length,
      filled: jobs.filter(j => j.status === 'FILLED').length,
    };
  }
}
