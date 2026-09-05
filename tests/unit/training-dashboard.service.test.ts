import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrainingOverview } from '@/services/dashboard.service';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * getTrainingOverview() is the training-persona counterpart to
 * getRoleAwareOverview() (see dashboard.service.test.ts for that one) —
 * covers INSTITUTE_ADMIN/TRAINER/TRAINEE/EMPLOYER, which previously had no
 * dashboard data path at all (found during Phase 10's Command Center
 * review: these personas silently fell through to all-zero apexfintech
 * metrics and an unfiltered org-wide incidents feed).
 *
 * Same chainable-mock-builder pattern as dashboard.service.test.ts: each
 * `.from(table)` call returns a thenable whose methods all return itself,
 * so `resolve()` inside `then` decides what the awaited query returns. A
 * few tables are queried more than once per persona with different
 * filters (e.g. `batches` for both a count and an ending-soon list), so
 * `callCounts` tracks per-table invocation order to respond correctly.
 */
function buildMockSupabase(perTable: Record<string, (call: number) => any>): SupabaseClient {
  const callCounts: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    callCounts[table] = (callCounts[table] ?? 0) + 1;
    const call = callCounts[table];
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      is: vi.fn(() => builder),
      not: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(() => {
        const resolver = perTable[table];
        return Promise.resolve(resolver ? resolver(call) : { data: null, error: null });
      }),
      then: (resolve: any) => {
        const resolver = perTable[table];
        resolve(resolver ? resolver(call) : { count: 0, data: [], error: null });
      },
    };
    return builder;
  });
  return { from } as unknown as SupabaseClient;
}

describe('Dashboard Service - getTrainingOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('INSTITUTE_ADMIN: computes org-wide training counts and an ending-batches attention queue', async () => {
    const supabase = buildMockSupabase({
      trainees: () => ({ count: 42, data: null, error: null }),
      trainers: () => ({ count: 7, data: null, error: null }),
      batches: (call) => call === 1
        ? { count: 5, data: null, error: null } // active-batches count
        : { data: [{ id: 'batch-1', name: 'Batch A', end_date: '2026-09-10', status: 'ACTIVE' }], error: null }, // ending soon
      certificates: (call) => call === 1
        ? { data: [{ id: 'c1' }, { id: 'c2' }], error: null } // stats
        : { data: [{ id: 'c1', title: 'Cert A', issued_at: '2026-09-01', trainees: { profiles: { full_name: 'Asha' } } }], error: null }, // recent
    });

    const result = await getTrainingOverview(supabase, { orgId: 'org1', userId: 'u1', persona: 'INSTITUTE_ADMIN' });

    expect(result.metrics.activeTrainees).toBe(42);
    expect(result.metrics.activeTrainers).toBe(7);
    expect(result.metrics.activeBatches).toBe(5);
    expect(result.metrics.certificatesIssued).toBe(2);
    expect(result.attentionQueue).toHaveLength(1);
    expect(result.attentionQueue[0].entityType).toBe('batch');
    expect(result.upcomingDeadlines).toHaveLength(1);
    expect(result.recentActivity[0].actor).toBe('Asha');
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('TRAINER: resolves the caller\'s own trainer row and scopes everything to it', async () => {
    const supabase = buildMockSupabase({
      trainers: () => ({ data: { id: 'trainer-1' }, error: null }),
      batches: () => ({ data: [{ id: 'b1', name: 'Batch A', end_date: '2026-09-12' }], error: null }),
      enrollments: () => ({ count: 12, data: [], error: null }),
      courses: () => ({ data: [{ id: 'course-1' }], error: null }),
      assessments: () => ({ data: [{ id: 'assess-1' }], error: null }),
      assessment_results: (call) => call === 1
        ? { count: 3, data: [], error: null } // pending count
        : { data: [{ id: 'r1', submitted_at: '2026-09-01', trainees: { profiles: { full_name: 'Ravi' } } }], error: null },
      attendance_sessions: () => ({ count: 2, data: [], error: null }),
    });

    const result = await getTrainingOverview(supabase, { orgId: 'org1', userId: 'trainer-user', persona: 'TRAINER' });

    expect(result.metrics.myBatches).toBe(1);
    expect(result.metrics.myTrainees).toBe(12);
    expect(result.metrics.pendingGrading).toBe(3);
    expect(result.metrics.sessionsThisWeek).toBe(2);
    expect(result.attentionQueue).toHaveLength(1);
    expect(result.attentionQueue[0].entityType).toBe('assessment');
    expect(result.attentionQueue[0].ownerName).toBe('Ravi');
    expect(result.upcomingDeadlines).toHaveLength(1);
  });

  it('TRAINER: a role without a linked trainer row yet returns all-zero metrics, not a crash', async () => {
    const supabase = buildMockSupabase({
      trainers: () => ({ data: null, error: null }),
    });

    const result = await getTrainingOverview(supabase, { orgId: 'org1', userId: 'orphan-user', persona: 'TRAINER' });

    expect(result.metrics.myBatches).toBe(0);
    expect(result.metrics.pendingGrading).toBe(0);
    expect(result.attentionQueue).toHaveLength(0);
  });

  it('TRAINEE: resolves the caller\'s own trainee row, never a client-supplied id', async () => {
    const supabase = buildMockSupabase({
      trainees: () => ({ data: { id: 'trainee-1' }, error: null }),
      certificates: () => ({ count: 2, data: [], error: null }),
      job_applications: (call) => call === 1
        ? { count: 4, data: [], error: null } // total-applications count
        : { data: [{ id: 'a1', status: 'SHORTLISTED', jobs: { title: 'Backend Intern' } }], error: null }, // status-update queue
      assessment_results: (call) => call === 1
        ? { count: 6, data: [], error: null } // taken count
        : { data: [{ id: 'r1', score: 8, max_score: 10, submitted_at: '2026-09-01', assessments: { title: 'Quiz 1' } }], error: null },
      course_progress: () => ({ data: [{ course_id: 'course-1', completed: false }, { course_id: 'course-1', completed: false }, { course_id: 'course-2', completed: true }], error: null }),
    });

    const result = await getTrainingOverview(supabase, { orgId: 'org1', userId: 'trainee-user', persona: 'TRAINEE' });

    expect(result.metrics.myCertificates).toBe(2);
    expect(result.metrics.myApplications).toBe(4);
    expect(result.metrics.assessmentsTaken).toBe(6);
    // Two progress rows share course-1 (still incomplete) -> counted once, not twice.
    expect(result.metrics.coursesInProgress).toBe(1);
    expect(result.attentionQueue[0].title).toBe('Backend Intern');
    expect(result.recentActivity[0].action).toBe('scored 8/10 on');
  });

  it('EMPLOYER: resolves the caller\'s own employer row and scopes job stats to it', async () => {
    const supabase = buildMockSupabase({
      employers: () => ({ data: { id: 'employer-1' }, error: null }),
      jobs: (call) => {
        if (call === 1) return { count: 3, data: null, error: null }; // open count
        if (call === 2) return { count: 1, data: null, error: null }; // filled count
        return { data: [{ id: 'job-1', title: 'Backend Intern', deadline: '2026-09-20' }], error: null }; // myJobs list
      },
      job_applications: (call) => call === 1
        ? { count: 9, data: [], error: null } // total
        : call === 2
          ? { count: 2, data: [], error: null } // shortlisted
          : call === 3
            ? { data: [{ id: 'a1', status: 'APPLIED', jobs: { title: 'Backend Intern' }, trainees: { profiles: { full_name: 'Priya' } } }], error: null } // new applications
            : { data: [{ id: 'a1', applied_at: '2026-09-01', jobs: { title: 'Backend Intern' }, trainees: { profiles: { full_name: 'Priya' } } }], error: null }, // recent
    });

    const result = await getTrainingOverview(supabase, { orgId: 'org1', userId: 'employer-user', persona: 'EMPLOYER' });

    expect(result.metrics.activeJobPostings).toBe(3);
    expect(result.metrics.filledPositions).toBe(1);
    expect(result.metrics.totalApplications).toBe(9);
    expect(result.metrics.shortlisted).toBe(2);
    expect(result.attentionQueue[0].ownerName).toBe('Priya');
    expect(result.upcomingDeadlines).toHaveLength(1);
    expect(result.recentActivity[0].targetName).toBe('Backend Intern');
  });
});
