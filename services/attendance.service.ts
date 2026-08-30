import { SupabaseClient } from '@supabase/supabase-js';

export interface AttendanceSession {
  id: string;
  batch_id: string;
  date: string;
  session_type: string;
  session_slot: string;
  qr_token?: string;
  qr_expires_at?: string;
  trainer_id?: string;
  is_active: boolean;
  created_at: string;
  batches?: { name: string; programme_id: string };
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  trainee_id: string;
  method: string;
  status: string;
  marked_at: string;
  verified_by?: string;
  trainees?: { profiles: { full_name: string; email: string } };
}

export class AttendanceService {
  constructor(private supabase: SupabaseClient) {}

  async createSession(input: { batch_id: string; session_type?: string; session_slot?: string; trainer_id?: string }) {
    // Generate a time-limited QR token
    const qrToken = crypto.randomUUID();
    const qrExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry

    const { data, error } = await this.supabase
      .from('attendance_sessions')
      .insert({
        ...input,
        qr_token: qrToken,
        qr_expires_at: qrExpiresAt,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceSession;
  }

  async markAttendance(input: { session_id: string; trainee_id: string; method?: string; status?: string }) {
    const { data, error } = await this.supabase
      .from('attendance_records')
      .insert({
        session_id: input.session_id,
        trainee_id: input.trainee_id,
        method: input.method || 'MANUAL',
        status: input.status || 'PRESENT',
      })
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  }

  async markAttendanceByQR(qrToken: string, traineeId: string) {
    // Verify QR token is valid and not expired
    const { data: session, error: sessionError } = await this.supabase
      .from('attendance_sessions')
      .select('*')
      .eq('qr_token', qrToken)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) throw new Error('Invalid or expired QR code');
    if (new Date(session.qr_expires_at) < new Date()) throw new Error('QR code has expired');

    return this.markAttendance({
      session_id: session.id,
      trainee_id: traineeId,
      method: 'QR',
    });
  }

  async getSessionRecords(sessionId: string) {
    const { data, error } = await this.supabase
      .from('attendance_records')
      .select('*, trainees(id, profiles:user_id(full_name, email))')
      .eq('session_id', sessionId)
      .order('marked_at');
    if (error) throw error;
    return data;
  }

  async getBatchSessions(batchId: string, filters?: { date?: string }) {
    let q = this.supabase
      .from('attendance_sessions')
      .select('*, attendance_records(count)')
      .eq('batch_id', batchId)
      .order('date', { ascending: false });

    if (filters?.date) q = q.eq('date', filters.date);

    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async getTraineeAttendance(traineeId: string) {
    const { data, error } = await this.supabase
      .from('attendance_records')
      .select('*, attendance_sessions(date, session_type, batches(name))')
      .eq('trainee_id', traineeId)
      .order('marked_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getAttendanceStats(batchId: string) {
    const { data: sessions, error: sessError } = await this.supabase
      .from('attendance_sessions')
      .select('id')
      .eq('batch_id', batchId);
    if (sessError) throw sessError;

    const sessionIds = (sessions || []).map(s => s.id);
    if (sessionIds.length === 0) return { totalSessions: 0, averageAttendance: 0 };

    const { data: records, error: recError } = await this.supabase
      .from('attendance_records')
      .select('status')
      .in('session_id', sessionIds);
    if (recError) throw recError;

    const total = records?.length || 0;
    const present = records?.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length || 0;

    return {
      totalSessions: sessionIds.length,
      totalRecords: total,
      present,
      averageAttendance: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  async closeSession(sessionId: string) {
    const { error } = await this.supabase
      .from('attendance_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);
    if (error) throw error;
  }
}
