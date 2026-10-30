import { SupabaseClient } from '@supabase/supabase-js';

export interface Programme {
  id: string;
  organization_id: string;
  institution_id?: string;
  title: string;
  description?: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
  capacity: number;
  fee: number;
  status: string;
  created_at: string;
  updated_at: string;
  institutions?: { name: string; code: string };
}

export class ProgrammeService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  async list(filters?: { status?: string; institutionId?: string; search?: string }) {
    let q = this.supabase
      .from('programmes')
      .select('*, institutions(name, code)')
      .eq('organization_id', this.orgId)
      .order('created_at', { ascending: false });

    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.institutionId) q = q.eq('institution_id', filters.institutionId);
    if (filters?.search) q = q.ilike('title', `%${filters.search}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data as Programme[];
  }

  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('programmes')
      .select('*, institutions(name, code)')
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();
    if (error) throw error;
    return data as Programme;
  }

  async create(input: { title: string; description?: string; duration_days: number; start_date?: string; end_date?: string; capacity?: number; fee?: number; institution_id?: string; status?: string }) {
    const { data, error } = await this.supabase
      .from('programmes')
      .insert({ ...input, organization_id: this.orgId })
      .select()
      .single();
    if (error) throw error;
    return data as Programme;
  }

  async update(id: string, input: Partial<Programme>) {
    const { data, error } = await this.supabase
      .from('programmes')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();
    if (error) throw error;
    return data as Programme;
  }

  async delete(id: string) {
    const { error } = await this.supabase
      .from('programmes')
      .delete()
      .eq('id', id)
      .eq('organization_id', this.orgId);
    if (error) throw error;
  }

  async getStats() {
    const { data, error } = await this.supabase
      .from('programmes')
      .select('id, status, capacity')
      .eq('organization_id', this.orgId);
    if (error) throw error;
    const programmes = data || [];
    return {
      total: programmes.length,
      active: programmes.filter(p => p.status === 'ACTIVE').length,
      completed: programmes.filter(p => p.status === 'COMPLETED').length,
      totalCapacity: programmes.reduce((sum, p) => sum + (p.capacity || 0), 0),
    };
  }
}
