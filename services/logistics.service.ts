import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Timetable, hostel and mess — the logistics half of PS 26087.
 *
 * The important behaviour is in publish(): a published timetable slot creates
 * the attendance_sessions row rather than leaving a trainer to make one at
 * marking time. Otherwise the plan and the register are separate objects that
 * drift apart, which is the failure this feature exists to prevent.
 */

export interface TimetableSlot {
  id: string;
  organization_id: string;
  batch_id: string;
  course_id?: string | null;
  trainer_id?: string | null;
  room_id?: string | null;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  session_type: string;
  attendance_session_id?: string | null;
  status: string;
  notes?: string | null;
}

export interface Conflict { id: string; title: string; reason: string }

export class LogisticsService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  /* ------------------------------------------------------------- timetable */

  async listSlots(filters?: { batchId?: string; from?: string; to?: string }) {
    let q = this.supabase
      .from('timetable_slots')
      .select('*, batches(name), courses(title), rooms(name, capacity), trainers(profiles:user_id(full_name))')
      .eq('organization_id', this.orgId)
      .order('date')
      .order('start_time');

    if (filters?.batchId) q = q.eq('batch_id', filters.batchId);
    if (filters?.from) q = q.gte('date', filters.from);
    if (filters?.to) q = q.lte('date', filters.to);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  /**
   * Asks the database, not the service, whether this slot clashes — the same
   * question has to hold for any writer, and the overlap comparison is cheaper
   * and more correct in SQL.
   */
  async findConflicts(input: {
    date: string; start_time: string; end_time: string;
    room_id?: string | null; trainer_id?: string | null; batch_id: string;
    exclude_id?: string;
  }): Promise<Conflict[]> {
    const { data, error } = await this.supabase.rpc('timetable_conflicts', {
      p_date: input.date,
      p_start: input.start_time,
      p_end: input.end_time,
      p_room: input.room_id ?? null,
      p_trainer: input.trainer_id ?? null,
      p_batch: input.batch_id,
      p_exclude: input.exclude_id ?? null,
    });
    if (error) throw error;
    return (data || []) as Conflict[];
  }

  async createSlot(input: Partial<TimetableSlot> & { batch_id: string; title: string; date: string; start_time: string; end_time: string }) {
    const conflicts = await this.findConflicts({
      date: input.date,
      start_time: input.start_time,
      end_time: input.end_time,
      room_id: input.room_id,
      trainer_id: input.trainer_id,
      batch_id: input.batch_id,
    });

    if (conflicts.length) {
      // Naming what clashes and why, because "conflict" alone leaves the
      // planner guessing which of the three constraints they hit.
      const detail = conflicts.map((c) => `${c.title} (${c.reason})`).join('; ');
      throw new Error(`That slot clashes with: ${detail}`);
    }

    const { data, error } = await this.supabase
      .from('timetable_slots')
      .insert({ ...input, organization_id: this.orgId, status: input.status || 'PLANNED' })
      .select()
      .single();
    if (error) throw error;
    return data as TimetableSlot;
  }

  /**
   * Publishing turns a plan into a register: it creates the attendance session
   * the trainer will actually mark against, and links the two.
   */
  async publishSlot(slotId: string) {
    const { data: slot, error } = await this.supabase
      .from('timetable_slots').select('*').eq('id', slotId).single();
    if (error) throw error;
    if (slot.status === 'CANCELLED') throw new Error('A cancelled slot cannot be published.');
    if (slot.attendance_session_id) return slot as TimetableSlot; // already published; idempotent

    // Slot times map onto the coarse session_slot the attendance schema uses.
    const hour = Number(String(slot.start_time).slice(0, 2));
    const sessionSlot = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';

    const { AttendanceService } = await import('./attendance.service');
    const attendance = new AttendanceService(this.supabase);
    const session = await attendance.createSession({
      batch_id: slot.batch_id,
      session_type: slot.session_type,
      session_slot: sessionSlot,
      trainer_id: slot.trainer_id || undefined,
    });

    const { data: updated, error: updateError } = await this.supabase
      .from('timetable_slots')
      .update({
        status: 'PUBLISHED',
        attendance_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', slotId)
      .select()
      .single();
    if (updateError) throw updateError;

    return updated as TimetableSlot;
  }

  /* ---------------------------------------------------------------- rooms */

  async listRooms(institutionId?: string) {
    let q = this.supabase.from('rooms').select('*').eq('organization_id', this.orgId).eq('is_active', true).order('name');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async createRoom(input: { name: string; institution_id?: string; kind?: string; capacity?: number; building?: string; floor?: string }) {
    const { data, error } = await this.supabase
      .from('rooms').insert({ ...input, organization_id: this.orgId }).select().single();
    if (error) throw error;
    return data;
  }

  /* --------------------------------------------------------------- hostel */

  async listHostels(institutionId?: string) {
    let q = this.supabase.from('hostels').select('*').eq('organization_id', this.orgId).eq('is_active', true).order('name');
    if (institutionId) q = q.eq('institution_id', institutionId);
    const { data: hostels, error } = await q;
    if (error) throw error;

    const ids = (hostels || []).map((h) => h.id);
    if (!ids.length) return [];

    const { data: allocations } = await this.supabase
      .from('hostel_allocations')
      .select('hostel_id, mess_opted')
      .in('hostel_id', ids)
      .eq('status', 'ACTIVE');

    return (hostels || []).map((h) => {
      const mine = (allocations || []).filter((a) => a.hostel_id === h.id);
      return {
        ...h,
        occupied: mine.length,
        available: Math.max(0, (h.total_beds || 0) - mine.length),
        mess_count: mine.filter((a) => a.mess_opted).length,
        occupancy_pct: h.total_beds ? Math.round((mine.length / h.total_beds) * 100) : null,
      };
    });
  }

  async createHostel(input: { name: string; institution_id?: string; gender?: string; total_beds?: number; warden_name?: string; warden_phone?: string }) {
    const { data, error } = await this.supabase
      .from('hostels').insert({ ...input, organization_id: this.orgId }).select().single();
    if (error) throw error;
    return data;
  }

  async listAllocations(hostelId?: string) {
    let q = this.supabase
      .from('hostel_allocations')
      .select('*, hostels(name, gender), trainees(id, profiles:user_id(full_name)), batches(name)')
      .eq('organization_id', this.orgId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });
    if (hostelId) q = q.eq('hostel_id', hostelId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async allocate(input: {
    hostel_id: string; trainee_id: string; batch_id?: string;
    room_number?: string; bed_number?: string;
    mess_opted?: boolean; dietary_preference?: string;
  }) {
    const { data: hostel, error } = await this.supabase
      .from('hostels').select('id, name, total_beds').eq('id', input.hostel_id).single();
    if (error) throw error;

    if (hostel.total_beds) {
      const { count } = await this.supabase
        .from('hostel_allocations')
        .select('id', { count: 'exact', head: true })
        .eq('hostel_id', input.hostel_id)
        .eq('status', 'ACTIVE');
      if ((count ?? 0) >= hostel.total_beds) {
        throw new Error(`${hostel.name} is full (${hostel.total_beds} beds).`);
      }
    }

    const { data, error: insertError } = await this.supabase
      .from('hostel_allocations')
      .insert({ ...input, organization_id: this.orgId, status: 'ACTIVE' })
      .select()
      .single();

    if (insertError) {
      // The partial unique index is the real guard against double-booking;
      // translate it rather than leaking a constraint name.
      if (insertError.code === '23505') {
        throw new Error('That trainee already has an active hostel allocation.');
      }
      throw insertError;
    }
    return data;
  }

  async checkOut(allocationId: string) {
    const { data, error } = await this.supabase
      .from('hostel_allocations')
      .update({ status: 'CHECKED_OUT', check_out: new Date().toISOString().slice(0, 10) })
      .eq('id', allocationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Head-count per diet, which is what a mess actually needs each morning. */
  async getMessSummary() {
    const { data, error } = await this.supabase
      .from('hostel_allocations')
      .select('dietary_preference, mess_opted, hostels(name)')
      .eq('organization_id', this.orgId)
      .eq('status', 'ACTIVE');
    if (error) throw error;

    const opted = (data || []).filter((a) => a.mess_opted);
    const byDiet: Record<string, number> = {};
    for (const a of opted) {
      const key = a.dietary_preference || 'VEG';
      byDiet[key] = (byDiet[key] || 0) + 1;
    }
    return { total: opted.length, byDiet };
  }
}
