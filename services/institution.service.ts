import { SupabaseClient } from '@supabase/supabase-js';

export interface Institution {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  type: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contact_email?: string;
  contact_phone?: string;
  capacity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export class InstitutionService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  async list(filters?: { status?: string; search?: string }) {
    let q = this.supabase
      .from('institutions')
      .select('*')
      .eq('organization_id', this.orgId)
      .order('name');

    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.search) q = q.ilike('name', `%${filters.search}%`);

    const { data, error } = await q;
    if (error) throw error;
    return data as Institution[];
  }

  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('institutions')
      .select('*')
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();
    if (error) throw error;
    return data as Institution;
  }

  // capacity and status have column defaults.
  async create(input: Omit<Institution, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'capacity' | 'status'> & Partial<Pick<Institution, 'capacity' | 'status'>>) {
    const { data, error } = await this.supabase
      .from('institutions')
      .insert({ ...input, organization_id: this.orgId })
      .select()
      .single();
    if (error) throw error;
    return data as Institution;
  }

  async update(id: string, input: Partial<Institution>) {
    const { data, error } = await this.supabase
      .from('institutions')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();
    if (error) throw error;
    return data as Institution;
  }

  async delete(id: string) {
    const { error } = await this.supabase
      .from('institutions')
      .delete()
      .eq('id', id)
      .eq('organization_id', this.orgId);
    if (error) throw error;
  }

  async getStats() {
    const { data, error } = await this.supabase
      .from('institutions')
      .select('id, status, capacity')
      .eq('organization_id', this.orgId);
    if (error) throw error;
    const institutions = data || [];
    return {
      total: institutions.length,
      active: institutions.filter(i => i.status === 'ACTIVE').length,
      totalCapacity: institutions.reduce((sum, i) => sum + (i.capacity || 0), 0),
    };
  }
}
