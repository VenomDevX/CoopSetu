import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Enrolment and nomination — the transactional spine PS 26087 leads with.
 *
 * The `enrollments` table has carried the right lifecycle since 0071, but
 * nothing in the application ever wrote to it (the only INSERT was the demo
 * seeder), so PENDING and APPROVED were unreachable states. This service is
 * that missing write path.
 *
 *   nominate / selfRegister  ->  PENDING
 *   approve                  ->  APPROVED    reject -> REJECTED
 *   enrol (assign a batch)   ->  ENROLLED
 *   complete                 ->  COMPLETED   drop  -> DROPPED
 */

export type EnrollmentStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ENROLLED' | 'COMPLETED' | 'DROPPED';

export interface Enrollment {
  id: string;
  trainee_id: string;
  programme_id: string;
  batch_id?: string | null;
  status: EnrollmentStatus;
  source: 'SELF' | 'NOMINATED';
  nominated_by?: string | null;
  nominated_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  remarks?: string | null;
  enrolled_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  trainees?: { id: string; education?: string; location?: string; profiles?: { full_name?: string; email?: string } };
  programmes?: { title: string; institution_id?: string };
  batches?: { name: string } | null;
}

/**
 * Which statuses may follow which. Enforced here rather than by a database
 * trigger so the caller gets a readable message instead of a constraint
 * violation, and so the rule lives next to the code that reads it.
 */
const ALLOWED_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  PENDING:   ['APPROVED', 'REJECTED'],
  APPROVED:  ['ENROLLED', 'REJECTED'],
  REJECTED:  [],
  ENROLLED:  ['COMPLETED', 'DROPPED'],
  COMPLETED: [],
  DROPPED:   [],
};

export class EnrollmentService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  private readonly SELECT =
    '*, trainees(id, education, location, profiles:user_id(full_name, email)), programmes(title, institution_id), batches(name)';

  async list(filters?: { programmeId?: string; status?: string; traineeId?: string; batchId?: string }) {
    let q = this.supabase
      .from('enrollments')
      .select(this.SELECT)
      .order('created_at', { ascending: false });

    if (filters?.programmeId) q = q.eq('programme_id', filters.programmeId);
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.traineeId) q = q.eq('trainee_id', filters.traineeId);
    if (filters?.batchId) q = q.eq('batch_id', filters.batchId);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as Enrollment[];
  }

  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('enrollments').select(this.SELECT).eq('id', id).single();
    if (error) throw error;
    return data as unknown as Enrollment;
  }

  /** An institute puts a candidate forward for a programme. */
  async nominate(input: { trainee_id: string; programme_id: string; remarks?: string }, actorUserId: string) {
    return this.createPending({ ...input, source: 'NOMINATED', actorUserId });
  }

  /** A candidate applies to a programme themselves. */
  async selfRegister(input: { trainee_id: string; programme_id: string; remarks?: string }, actorUserId: string) {
    return this.createPending({ ...input, source: 'SELF', actorUserId });
  }

  private async createPending(input: {
    trainee_id: string; programme_id: string; remarks?: string;
    source: 'SELF' | 'NOMINATED'; actorUserId: string;
  }) {
    // UNIQUE(trainee_id, programme_id) means a re-nomination raises 23505.
    // Check first so the caller gets an explanation rather than a raw
    // constraint name — this is a routine collision, not an exceptional one.
    const { data: existing } = await this.supabase
      .from('enrollments')
      .select('id, status')
      .eq('trainee_id', input.trainee_id)
      .eq('programme_id', input.programme_id)
      .maybeSingle();

    if (existing) {
      throw new Error(
        `This trainee already has a ${existing.status} record for this programme.`,
      );
    }

    const { data, error } = await this.supabase
      .from('enrollments')
      .insert({
        trainee_id: input.trainee_id,
        programme_id: input.programme_id,
        status: 'PENDING',
        source: input.source,
        nominated_by: input.actorUserId,
        nominated_at: new Date().toISOString(),
        remarks: input.remarks || null,
      })
      .select(this.SELECT)
      .single();

    if (error) throw error;
    return data as unknown as Enrollment;
  }

  /**
   * Single entry point for every status change, so the transition table is
   * consulted exactly once and no caller can skip it.
   */
  async transition(
    id: string,
    next: EnrollmentStatus,
    actorUserId: string,
    opts?: { batch_id?: string; remarks?: string },
  ) {
    const current = await this.getById(id);

    if (!ALLOWED_TRANSITIONS[current.status].includes(next)) {
      throw new Error(
        `Cannot move an enrolment from ${current.status} to ${next}.` +
          (ALLOWED_TRANSITIONS[current.status].length
            ? ` Allowed: ${ALLOWED_TRANSITIONS[current.status].join(', ')}.`
            : ' That status is final.'),
      );
    }

    if (next === 'ENROLLED' && !opts?.batch_id && !current.batch_id) {
      throw new Error('A batch must be assigned before enrolling a trainee.');
    }

    if (opts?.batch_id) await this.assertBatchHasRoom(opts.batch_id);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: next,
      updated_at: now,
      decided_by: actorUserId,
      decided_at: now,
    };
    if (opts?.batch_id) patch.batch_id = opts.batch_id;
    if (opts?.remarks !== undefined) patch.remarks = opts.remarks;
    if (next === 'ENROLLED') patch.enrolled_at = now;
    if (next === 'COMPLETED') patch.completed_at = now;

    const { data, error } = await this.supabase
      .from('enrollments').update(patch).eq('id', id).select(this.SELECT).single();

    if (error) throw error;
    return data as unknown as Enrollment;
  }

  approve(id: string, actor: string, batchId?: string, remarks?: string) {
    return this.transition(id, 'APPROVED', actor, { batch_id: batchId, remarks });
  }
  reject(id: string, actor: string, remarks?: string) {
    return this.transition(id, 'REJECTED', actor, { remarks });
  }
  enrol(id: string, actor: string, batchId?: string) {
    return this.transition(id, 'ENROLLED', actor, { batch_id: batchId });
  }
  complete(id: string, actor: string) { return this.transition(id, 'COMPLETED', actor); }
  drop(id: string, actor: string, remarks?: string) {
    return this.transition(id, 'DROPPED', actor, { remarks });
  }

  /**
   * Batch capacity is advisory in the schema (no constraint), so it is checked
   * here. Counting ENROLLED only — approved-but-unassigned candidates have not
   * taken a seat yet.
   */
  private async assertBatchHasRoom(batchId: string) {
    const { data: batch, error } = await this.supabase
      .from('batches').select('id, name, capacity').eq('id', batchId).single();
    if (error) throw error;
    if (!batch?.capacity) return; // 0 or null = uncapped

    const { count, error: countError } = await this.supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('status', 'ENROLLED');
    if (countError) throw countError;

    if ((count ?? 0) >= batch.capacity) {
      throw new Error(`Batch "${batch.name}" is full (${batch.capacity} seats).`);
    }
  }

  /** Funnel counts for the nominations screen and the analytics rollup. */
  async getStats(programmeId?: string) {
    let q = this.supabase.from('enrollments').select('status, source');
    if (programmeId) q = q.eq('programme_id', programmeId);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      pending: by('PENDING'),
      approved: by('APPROVED'),
      rejected: by('REJECTED'),
      enrolled: by('ENROLLED'),
      completed: by('COMPLETED'),
      dropped: by('DROPPED'),
      nominated: rows.filter((r) => r.source === 'NOMINATED').length,
      selfRegistered: rows.filter((r) => r.source === 'SELF').length,
    };
  }
}
