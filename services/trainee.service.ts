import { SupabaseClient } from '@supabase/supabase-js';

export interface Trainee {
  id: string;
  user_id: string;
  organization_id: string;
  education?: string;
  location?: string;
  languages: string[];
  experience?: string;
  profile_photo?: string;
  digital_literacy_level: string;
  employment_status: string;
  date_of_birth?: string;
  gender?: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string };
}

export class TraineeService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  async list(filters?: { status?: string; search?: string; employment_status?: string }) {
    let q = this.supabase
      .from('trainees')
      .select('*, profiles:user_id(full_name, email)')
      .eq('organization_id', this.orgId)
      .order('created_at', { ascending: false });

    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.employment_status) q = q.eq('employment_status', filters.employment_status);
    if (filters?.search) q = q.or(`education.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data as Trainee[];
  }

  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('trainees')
      .select('*, profiles:user_id(full_name, email)')
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();
    if (error) throw error;
    return data as Trainee;
  }

  async create(input: { user_id: string; education?: string; location?: string; languages?: string[]; experience?: string; digital_literacy_level?: string; employment_status?: string; date_of_birth?: string; gender?: string }) {
    const { data, error } = await this.supabase
      .from('trainees')
      .insert({ ...input, organization_id: this.orgId })
      .select()
      .single();
    if (error) throw error;
    return data as Trainee;
  }

  async update(id: string, input: Partial<Trainee>) {
    const { data, error } = await this.supabase
      .from('trainees')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();
    if (error) throw error;
    return data as Trainee;
  }

  async getStats() {
    const { data, error } = await this.supabase
      .from('trainees')
      .select('id, status, employment_status')
      .eq('organization_id', this.orgId);
    if (error) throw error;
    const trainees = data || [];
    return {
      total: trainees.length,
      active: trainees.filter(t => t.status === 'ACTIVE').length,
      graduated: trainees.filter(t => t.status === 'GRADUATED').length,
      employed: trainees.filter(t => t.employment_status === 'EMPLOYED').length,
    };
  }

  async getSkills(traineeId: string) {
    const { data, error } = await this.supabase
      .from('trainee_skills')
      .select('*, skills(name, category)')
      .eq('trainee_id', traineeId);
    if (error) throw error;
    return data;
  }

  async getCertificates(traineeId: string) {
    const { data, error } = await this.supabase
      .from('certificates')
      .select('*, programmes(title)')
      .eq('trainee_id', traineeId)
      .order('issued_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getEnrollments(traineeId: string) {
    const { data, error } = await this.supabase
      .from('enrollments')
      .select('*, programmes(title, status), batches(name)')
      .eq('trainee_id', traineeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
