import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Training analytics — the outcome view PS 26087 asks for.
 *
 * /dashboard/analytics showed sprint velocity, release analytics and incident
 * MTTR to institute admins, inherited from the delivery-management core. None
 * of it is about training, attendance, placement or skills. This service is the
 * training-domain equivalent.
 *
 * The headline is the funnel, because the problem statement's own framing is a
 * journey: registered -> trained -> certified -> employed. Reporting each stage
 * as an isolated count hides exactly the thing NCCT wants to see, which is
 * where people fall out.
 *
 * Every figure is computed from real rows. Where a number cannot be derived it
 * is omitted rather than estimated — a fabricated placement rate is worse than
 * an absent one.
 */

export interface Funnel {
  registered: number;
  nominated: number;
  enrolled: number;
  completed: number;
  certified: number;
  employed: number;
}

export class TrainingAnalyticsService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  /**
   * @param institutionIds when given, restricts to these institutes. Callers
   * pass the viewer's subtree; omitting it means the whole organization, which
   * is what the national view wants.
   */
  async getFunnel(institutionIds?: string[]): Promise<Funnel> {
    let traineeQ = this.supabase
      .from('trainees')
      .select('id, employment_status')
      .eq('organization_id', this.orgId);
    if (institutionIds?.length) traineeQ = traineeQ.in('institution_id', institutionIds);

    const { data: trainees, error } = await traineeQ;
    if (error) throw error;

    const traineeIds = (trainees || []).map((t) => t.id);
    if (!traineeIds.length) {
      return { registered: 0, nominated: 0, enrolled: 0, completed: 0, certified: 0, employed: 0 };
    }

    const [enrolments, certs] = await Promise.all([
      this.supabase.from('enrollments').select('status, trainee_id').in('trainee_id', traineeIds),
      this.supabase.from('certificates').select('id, trainee_id').in('trainee_id', traineeIds),
    ]);
    if (enrolments.error) throw enrolments.error;
    if (certs.error) throw certs.error;

    const rows = enrolments.data || [];
    // Counting distinct trainees per stage, not rows: a trainee enrolled in two
    // programmes is one person who reached "enrolled", and counting rows would
    // inflate every stage for the most active trainees.
    const distinct = (pred: (r: { status: string }) => boolean) =>
      new Set(rows.filter(pred).map((r) => r.trainee_id)).size;

    return {
      registered: traineeIds.length,
      nominated: distinct(() => true),
      enrolled: distinct((r) => ['ENROLLED', 'COMPLETED'].includes(r.status)),
      completed: distinct((r) => r.status === 'COMPLETED'),
      certified: new Set((certs.data || []).map((c) => c.trainee_id)).size,
      employed: (trainees || []).filter((t) =>
        ['EMPLOYED', 'SELF_EMPLOYED'].includes(t.employment_status),
      ).length,
    };
  }

  /** Attendance percentage per day, most recent first, for a trend line. */
  async getAttendanceTrend(days = 30, institutionIds?: string[]) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    let sessionQ = this.supabase
      .from('attendance_sessions')
      .select('id, date, batches(programme_id, programmes(institution_id))')
      .gte('date', since);
    const { data: sessions, error } = await sessionQ;
    if (error) throw error;

    const relevant = (sessions || []).filter((s: any) => {
      if (!institutionIds?.length) return true;
      const inst = s.batches?.programmes?.institution_id;
      // A session whose programme has no institute is org-wide, so it counts
      // for everyone rather than disappearing from every institute's view.
      return !inst || institutionIds.includes(inst);
    });
    if (!relevant.length) return [];

    const { data: records, error: recError } = await this.supabase
      .from('attendance_records')
      .select('session_id, status')
      .in('session_id', relevant.map((s: any) => s.id));
    if (recError) throw recError;

    const byDate = new Map<string, { present: number; total: number }>();
    const dateOf = new Map(relevant.map((s: any) => [s.id, s.date]));

    for (const r of records || []) {
      const date = dateOf.get(r.session_id);
      if (!date) continue;
      const bucket = byDate.get(date) || { present: 0, total: 0 };
      bucket.total += 1;
      if (r.status === 'PRESENT' || r.status === 'LATE') bucket.present += 1;
      byDate.set(date, bucket);
    }

    return [...byDate.entries()]
      .map(([date, b]) => ({ date, pct: Math.round((b.present / b.total) * 100), marked: b.total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Trainees at risk of dropping out, so a trainer can intervene before it
   * happens rather than reading about it afterwards. Deliberately a simple,
   * explainable rule — a trainer has to be able to see why someone is on the
   * list and disagree with it.
   */
  async getDropoutRisk(institutionIds?: string[]) {
    let q = this.supabase
      .from('enrollments')
      .select('id, trainee_id, status, trainees(id, institution_id, profiles:user_id(full_name))')
      .eq('status', 'ENROLLED');
    const { data: enrolled, error } = await q;
    if (error) throw error;

    const scoped = (enrolled || []).filter((e: any) =>
      !institutionIds?.length || institutionIds.includes(e.trainees?.institution_id),
    );
    if (!scoped.length) return [];

    const traineeIds = scoped.map((e: any) => e.trainee_id);
    const [attendance, progress] = await Promise.all([
      this.supabase.from('attendance_records').select('trainee_id, status').in('trainee_id', traineeIds),
      this.supabase.from('course_progress').select('trainee_id, completed').in('trainee_id', traineeIds),
    ]);

    return scoped
      .map((e: any) => {
        const att = (attendance.data || []).filter((a) => a.trainee_id === e.trainee_id);
        const present = att.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
        const attendancePct = att.length ? Math.round((present / att.length) * 100) : null;
        const prog = (progress.data || []).filter((p) => p.trainee_id === e.trainee_id);
        const modulesDone = prog.filter((p) => p.completed).length;

        const reasons: string[] = [];
        if (attendancePct !== null && attendancePct < 60) reasons.push(`attendance ${attendancePct}%`);
        if (att.length >= 3 && modulesDone === 0) reasons.push('no modules completed');
        if (attendancePct === null && att.length === 0) reasons.push('never marked present');

        return {
          trainee_id: e.trainee_id,
          name: e.trainees?.profiles?.full_name || 'Unnamed trainee',
          attendance_pct: attendancePct,
          modules_completed: modulesDone,
          reasons,
        };
      })
      .filter((r) => r.reasons.length > 0)
      .sort((a, b) => (a.attendance_pct ?? 0) - (b.attendance_pct ?? 0));
  }

  /**
   * Per-institute rollup for the national view. This is the figure NCCT cannot
   * get today: getTrainingOverview() is scoped to one organization and has no
   * notion of the institution tree at all.
   */
  async getInstitutionRollup() {
    const { data: institutions, error } = await this.supabase
      .from('institutions')
      .select('id, name, code, type, level, state, capacity, parent_institution_id')
      .eq('organization_id', this.orgId)
      .order('level');
    if (error) throw error;

    const rows = institutions || [];
    if (!rows.length) return [];

    const [trainees, programmes, certificates] = await Promise.all([
      this.supabase.from('trainees').select('institution_id').eq('organization_id', this.orgId),
      this.supabase.from('programmes').select('institution_id, status').eq('organization_id', this.orgId),
      this.supabase.from('certificates').select('id, trainees(institution_id)'),
    ]);

    return rows.map((i) => {
      const traineeCount = (trainees.data || []).filter((t) => t.institution_id === i.id).length;
      return {
        ...i,
        trainees: traineeCount,
        programmes: (programmes.data || []).filter((p) => p.institution_id === i.id).length,
        active_programmes: (programmes.data || []).filter(
          (p) => p.institution_id === i.id && p.status === 'ACTIVE',
        ).length,
        certificates: (certificates.data || []).filter(
          (c: any) => c.trainees?.institution_id === i.id,
        ).length,
        // Capacity of 0 means uncapped, so utilisation is undefined rather
        // than infinite or zero.
        utilisation_pct: i.capacity ? Math.round((traineeCount / i.capacity) * 100) : null,
      };
    });
  }

  /** Where trainees actually are, for outreach planning. */
  async getGeographicSpread() {
    const { data, error } = await this.supabase
      .from('institutions')
      .select('state, id')
      .eq('organization_id', this.orgId);
    if (error) throw error;

    const { data: trainees } = await this.supabase
      .from('trainees')
      .select('institution_id')
      .eq('organization_id', this.orgId);

    const stateOf = new Map((data || []).map((i) => [i.id, i.state || 'Unspecified']));
    const counts = new Map<string, number>();
    for (const t of trainees || []) {
      const state = stateOf.get(t.institution_id as string) || 'Unspecified';
      counts.set(state, (counts.get(state) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([state, trainees]) => ({ state, trainees }))
      .sort((a, b) => b.trainees - a.trainees);
  }
}
