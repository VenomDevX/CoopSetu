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

type RowsPage<T> = PromiseLike<{ data: T[] | null; error: unknown }>;
/** Builds one page: rows with id > `after` (all rows when null), ordered by id, at most `limit`. */
type PageQuery<T> = (after: string | null, limit: number) => RowsPage<T>;

// PostgREST returns at most max_rows (1000, supabase/config.toml) per request
// and silently drops the rest, so a single query here under-counted as soon as
// there were more than 1000 attendance records. Pages must be <= max_rows.
const PAGE_SIZE = 1000;
// A UUID is 36 chars, so an IN list of every session id ran to ~40 KB and the
// gateway rejected the request with "URI too long". 150 ids keeps it ~6 KB.
const IN_CHUNK = 150;

/**
 * Every row of a query, fetched page by page with keyset paging (id > last id).
 * Not OFFSET: row-level security is evaluated per row, and OFFSET makes each
 * page re-check every row before it — 8 pages of attendance_records took 3.2 s
 * that way, versus one pass over the rows with keyset paging.
 */
export async function allRows<T extends { id: string }>(page: PageQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  let after: string | null = null;
  for (;;) {
    const { data, error } = await page(after, PAGE_SIZE);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
    after = batch[batch.length - 1].id;
  }
}

/** Applies `page`'s keyset window to a query builder. */
function keyset<Q extends { gt: (c: string, v: string) => Q; order: (c: string) => Q; limit: (n: number) => Q }>(q: Q, after: string | null, limit: number): Q {
  return (after ? q.gt('id', after) : q).order('id').limit(limit);
}

/** Every row matching `column IN ids`, with the id list split to keep URLs short. */
export async function allRowsIn<T extends { id: string }>(ids: string[], page: (ids: string[], after: string | null, limit: number) => RowsPage<T>): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
  const parts = await Promise.all(chunks.map((chunk) => allRows<T>((after, limit) => page(chunk, after, limit))));
  return parts.flat();
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

    const [rows, certs] = await Promise.all([
      allRowsIn<{ id: string; status: string; trainee_id: string }>(traineeIds, (ids, after, limit) =>
        keyset(this.supabase.from('enrollments').select('id, status, trainee_id').in('trainee_id', ids), after, limit)),
      allRowsIn<{ id: string; trainee_id: string }>(traineeIds, (ids, after, limit) =>
        keyset(this.supabase.from('certificates').select('id, trainee_id').in('trainee_id', ids), after, limit)),
    ]);

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
      certified: new Set(certs.map((c) => c.trainee_id)).size,
      employed: (trainees || []).filter((t) =>
        ['EMPLOYED', 'SELF_EMPLOYED'].includes(t.employment_status),
      ).length,
    };
  }

  /** Attendance percentage per day, most recent first, for a trend line. */
  async getAttendanceTrend(days = 30, institutionIds?: string[]) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    const sessions = await allRows<any>((after, limit) => keyset(this.supabase
      .from('attendance_sessions')
      .select('id, date, batches(programme_id, programmes(institution_id))')
      .gte('date', since), after, limit));

    const relevant = sessions.filter((s: any) => {
      if (!institutionIds?.length) return true;
      const inst = s.batches?.programmes?.institution_id;
      // A session whose programme has no institute is org-wide, so it counts
      // for everyone rather than disappearing from every institute's view.
      return !inst || institutionIds.includes(inst);
    });
    if (!relevant.length) return [];

    const records = await allRowsIn<{ id: string; session_id: string; status: string }>(
      relevant.map((s: any) => s.id),
      (ids, after, limit) => keyset(this.supabase
        .from('attendance_records')
        .select('id, session_id, status')
        .in('session_id', ids), after, limit),
    );

    const byDate = new Map<string, { present: number; total: number }>();
    const dateOf = new Map(relevant.map((s: any) => [s.id, s.date]));

    for (const r of records) {
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
    const enrolled = await allRows<any>((after, limit) => keyset(this.supabase
      .from('enrollments')
      .select('id, trainee_id, status, trainees(id, institution_id, profiles:user_id(full_name))')
      .eq('status', 'ENROLLED'), after, limit));

    const scoped = enrolled.filter((e: any) =>
      !institutionIds?.length || institutionIds.includes(e.trainees?.institution_id),
    );
    if (!scoped.length) return [];

    const traineeIds = scoped.map((e: any) => e.trainee_id);
    const [attendance, progress] = await Promise.all([
      allRowsIn<{ id: string; trainee_id: string; status: string }>(traineeIds, (ids, after, limit) =>
        keyset(this.supabase.from('attendance_records').select('id, trainee_id, status').in('trainee_id', ids), after, limit)),
      allRowsIn<{ id: string; trainee_id: string; completed: boolean }>(traineeIds, (ids, after, limit) =>
        keyset(this.supabase.from('course_progress').select('id, trainee_id, completed').in('trainee_id', ids), after, limit)),
    ]);

    return scoped
      .map((e: any) => {
        const att = attendance.filter((a) => a.trainee_id === e.trainee_id);
        const present = att.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
        const attendancePct = att.length ? Math.round((present / att.length) * 100) : null;
        const prog = progress.filter((p) => p.trainee_id === e.trainee_id);
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
