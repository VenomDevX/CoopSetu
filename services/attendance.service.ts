import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { TOTP } from 'totp-generator';
import crypto from 'crypto';

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

  // ========================
  // FACE RECOGNITION METHODS
  // ========================

  /**
   * Store a face embedding (128-dim float array) for a trainee.
   * The embedding is stored as a JSONB array in the trainees table.
   */
  async registerFaceEmbedding(traineeId: string, embedding: number[]) {
    if (!embedding || embedding.length !== 128) {
      throw new Error('Invalid face embedding. Expected 128-dimensional vector.');
    }

    const { error } = await this.supabase
      .from('trainees')
      .update({ face_embedding: embedding })
      .eq('id', traineeId);

    if (error) throw error;
  }

  /**
   * Verify a face embedding against the stored one and mark attendance.
   * Uses Euclidean distance — threshold of 0.6 is standard for face-api.js.
   */
  async verifyFaceAndMarkAttendance(traineeId: string, sessionId: string, embedding: number[]) {
    if (!embedding || embedding.length !== 128) {
      throw new Error('Invalid face embedding. Expected 128-dimensional vector.');
    }

    // Fetch stored embedding
    const { data: trainee, error: traineeError } = await this.supabase
      .from('trainees')
      .select('face_embedding')
      .eq('id', traineeId)
      .single();

    if (traineeError || !trainee) throw new Error('Trainee not found.');
    if (!trainee.face_embedding) throw new Error('No face registered for this trainee. Please register your face first.');

    const storedEmbedding = trainee.face_embedding as number[];

    // Calculate Euclidean distance
    const distance = this.euclideanDistance(embedding, storedEmbedding);
    const threshold = 0.6; // Standard threshold for face-api.js
    const verified = distance < threshold;

    if (verified) {
      // Mark attendance with FACE method
      const record = await this.markAttendance({
        session_id: sessionId,
        trainee_id: traineeId,
        method: 'FACE',
      });
      return { verified: true, distance: 1 - distance, record };
    }

    return { verified: false, distance: 1 - distance };
  }

  /**
   * Euclidean distance between two embedding vectors.
   */
  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Embedding dimensions mismatch.');
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
  // ========================
  // HARDWARE QR & TOTP METHODS
  // ========================

  /**
   * Get or generate a TOTP secret for a trainee.
   */
  async getOrGenerateTotpSecret(userId: string): Promise<string> {
    const { data: profile, error: getError } = await this.supabase
      .from('profiles')
      .select('totp_secret')
      .eq('id', userId)
      .single();

    if (getError && getError.code !== 'PGRST116') throw getError; // ignore not found for now, handle below
    if (!profile) throw new Error('User profile not found');

    if (profile.totp_secret) {
      return profile.totp_secret;
    }

    // Import otplib dynamically to avoid Edge runtime issues if this runs there,
    // though this service is typically used in Node APIs.
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let newSecret = '';
    const bytes = crypto.randomBytes(20);
    for (let i = 0; i < 20; i++) {
      newSecret += chars[bytes[i] % 32];
    }

    const { error: updateError } = await this.supabase
      .from('profiles')
      .update({ totp_secret: newSecret })
      .eq('id', userId);

    if (updateError) throw updateError;
    return newSecret;
  }

  async verifyHardwareTotpAndMark(userId: string, token: string) {
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('totp_secret')
      .eq('id', userId)
      .single();

    if (profileError || !profile) throw new Error('User not found');
    if (!profile.totp_secret) throw new Error('User has no QR secret generated');

    // We allow a window of 1 step (30s) before/after to account for clock skew on hardware
    const now = Date.now();
    let isValid = false;
    for (let offset = -30000; offset <= 30000; offset += 30000) {
      const { otp: expectedToken } = await TOTP.generate(profile.totp_secret, { timestamp: now + offset });
      if (expectedToken === token) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      throw new Error('Invalid or expired QR code');
    }

    // Check if user is a trainee to mark attendance
    const { data: trainee } = await this.supabase
      .from('trainees')
      .select('batch_id')
      .eq('user_id', userId)
      .single();

    if (!trainee || !trainee.batch_id) {
      // User is authenticated but not a trainee (e.g. Trainer/Admin). Return success without marking batch attendance.
      return { status: 'PRESENT', recordId: null, message: 'Staff verified' };
    }

    // Find the currently active session for this batch
    const { data: activeSession, error: sessionError } = await this.supabase
      .from('attendance_sessions')
      .select('id')
      .eq('batch_id', trainee.batch_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !activeSession) {
      throw new Error('No active attendance session found for your batch right now.');
    }

    // Mark attendance
    return this.markAttendance({
      session_id: activeSession.id,
      trainee_id: traineeId,
      method: 'QR',
    });
  }
}


