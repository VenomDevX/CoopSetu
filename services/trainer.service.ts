import { SupabaseClient } from '@supabase/supabase-js';

export interface Trainer {
  id: string;
  user_id?: string;
  organization_id?: string;
  institution_id?: string;
  specialization?: string;
  qualification?: string;
  experience_years?: number;
  bio?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export class TrainerService {
  constructor(private supabase: SupabaseClient) {}

  async getTrainers(institutionId?: string) {
    let query = this.supabase
      .from('trainers')
      .select('*, profiles:user_id(full_name, email, avatar_url), institutions(name)')
      .order('created_at', { ascending: false });

    if (institutionId) {
      query = query.eq('institution_id', institutionId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data?.map(t => ({
      ...t,
      name: t.profiles?.full_name || 'Unregistered Trainer',
      email: t.profiles?.email,
      institution_name: t.institutions?.name
    }));
  }

  async getTrainerById(id: string) {
    const { data, error } = await this.supabase
      .from('trainers')
      .select('*, profiles:user_id(full_name, email, avatar_url), institutions(name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return {
      ...data,
      name: data.profiles?.full_name || 'Unregistered Trainer',
      email: data.profiles?.email,
      institution_name: data.institutions?.name
    };
  }

  async createTrainer(trainer: Partial<Trainer>) {
    const { data, error } = await this.supabase
      .from('trainers')
      .insert({
        ...trainer,
        status: trainer.status || 'ACTIVE'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTrainer(id: string, updates: Partial<Trainer>) {
    const { data, error } = await this.supabase
      .from('trainers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteTrainer(id: string) {
    const { error } = await this.supabase
      .from('trainers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}
