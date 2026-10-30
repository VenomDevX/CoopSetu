import { SupabaseClient } from '@supabase/supabase-js';

export interface Batch {
  id: string;
  organization_id?: string;
  programme_id: string;
  name: string;
  trainer_id?: string;
  start_date?: string;
  end_date?: string;
  capacity: number;
  room?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export class BatchService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  async getBatches(programmeId?: string) {
    let query = this.supabase
      .from('batches')
      .select('*, programmes(title), trainers(profiles:user_id(full_name))')
      .order('created_at', { ascending: false });

    if (programmeId) {
      query = query.eq('programme_id', programmeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Process joined data to make it easier for frontend
    return data?.map(b => ({
      ...b,
      programme_name: b.programmes?.title,
      trainer_name: b.trainers?.profiles?.full_name
    }));
  }

  async getBatchById(id: string) {
    const { data, error } = await this.supabase
      .from('batches')
      .select('*, programmes(title), trainers(profiles:user_id(full_name))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return {
      ...data,
      programme_name: data.programmes?.title,
      trainer_name: data.trainers?.profiles?.full_name
    };
  }

  async createBatch(batch: Partial<Batch>) {
    // organization_id was never set here, so every insert hit batches'
    // NOT NULL / RLS check and batch creation from the UI could not succeed.
    // Taken from the caller's membership rather than the request body: the
    // body is client-controlled, and a batch must belong to the org whose
    // session is making the call.
    const { data, error } = await this.supabase
      .from('batches')
      .insert({
        ...batch,
        organization_id: this.orgId,
        status: batch.status || 'UPCOMING'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateBatch(id: string, updates: Partial<Batch>) {
    const { data, error } = await this.supabase
      .from('batches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteBatch(id: string) {
    const { error } = await this.supabase
      .from('batches')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}
