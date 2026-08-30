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
    const { data, error } = await this.supabase
      .from('job_applications')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as JobApplication;
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
