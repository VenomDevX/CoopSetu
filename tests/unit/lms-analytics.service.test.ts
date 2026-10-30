import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LmsAnalyticsService } from '@/services/lms-analytics.service';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The two behaviours worth pinning down in LmsAnalyticsService:
 *
 *   - a badge is never awarded twice, and
 *   - the pace estimate refuses to answer from thin data.
 *
 * The second matters more than it looks. A projection drawn from one
 * afternoon's study would be presented to a trainee as a finish date, and
 * would be wrong by weeks — so "no answer" has to be a real code path, not a
 * fallback nobody exercises.
 *
 * Same chainable-mock-builder shape as training-dashboard.service.test.ts:
 * every builder method returns the builder, and `then` resolves whatever the
 * per-table resolver returns.
 */
function buildMockSupabase(
  perTable: Record<string, (call: number) => any>,
  inserts: Record<string, any[]> = {},
): SupabaseClient {
  const callCounts: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    callCounts[table] = (callCounts[table] ?? 0) + 1;
    const call = callCounts[table];
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn((rows: any) => {
        (inserts[table] ??= []).push(...(Array.isArray(rows) ? rows : [rows]));
        return Promise.resolve({ error: null });
      }),
      maybeSingle: vi.fn(() => Promise.resolve(perTable[table]?.(call) ?? { data: null, error: null })),
      then: (resolve: any) => resolve(perTable[table]?.(call) ?? { data: [], error: null }),
    };
    return builder;
  });
  return { from } as unknown as SupabaseClient;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe('evaluateAchievements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('awards a badge whose threshold the trainee has crossed', async () => {
    const inserts: Record<string, any[]> = {};
    const supabase = buildMockSupabase({
      course_progress: () => ({ data: [
        { course_id: 'c1', completed: true },
        { course_id: 'c1', completed: true },
        { course_id: 'c1', completed: true },
      ], error: null }),
      courses: () => ({ data: [{ id: 'c1', course_modules: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] }], error: null }),
      achievements: () => ({ data: [
        { id: 'a1', code: 'FIRST_STEPS', name: 'First Steps', tier: 'BRONZE', points: 10, criteria: { metric: 'modules_completed', threshold: 1 } },
        { id: 'a2', code: 'MARATHON', name: 'Marathon', tier: 'GOLD', points: 100, criteria: { metric: 'modules_completed', threshold: 50 } },
      ], error: null }),
      trainee_achievements: () => ({ data: [], error: null }),
    }, inserts);

    const earned = await new LmsAnalyticsService(supabase, 'org-1').evaluateAchievements('t1');

    expect(earned.map((e: any) => e.code)).toEqual(['FIRST_STEPS']);
    expect(inserts.trainee_achievements).toHaveLength(1);
    // The value that opened it is stored, so the shelf can say what they did.
    expect(inserts.trainee_achievements[0].unlocked_value).toBe(3);
  });

  it('does not award a badge the trainee already holds', async () => {
    const inserts: Record<string, any[]> = {};
    const supabase = buildMockSupabase({
      course_progress: () => ({ data: [{ course_id: 'c1', completed: true }], error: null }),
      courses: () => ({ data: [{ id: 'c1', course_modules: [{ id: 'm1' }] }], error: null }),
      achievements: () => ({ data: [
        { id: 'a1', code: 'FIRST_STEPS', name: 'First Steps', tier: 'BRONZE', points: 10, criteria: { metric: 'modules_completed', threshold: 1 } },
      ], error: null }),
      trainee_achievements: () => ({ data: [{ achievement_id: 'a1' }], error: null }),
    }, inserts);

    const earned = await new LmsAnalyticsService(supabase, 'org-1').evaluateAchievements('t1');

    expect(earned).toEqual([]);
    expect(inserts.trainee_achievements).toBeUndefined();
  });

  it('ignores an achievement whose criteria names an unknown metric', async () => {
    const inserts: Record<string, any[]> = {};
    const supabase = buildMockSupabase({
      course_progress: () => ({ data: [{ course_id: 'c1', completed: true }], error: null }),
      courses: () => ({ data: [{ id: 'c1', course_modules: [{ id: 'm1' }] }], error: null }),
      achievements: () => ({ data: [
        { id: 'a9', code: 'MYSTERY', name: 'Mystery', tier: 'GOLD', points: 5, criteria: { metric: 'something_else', threshold: 1 } },
      ], error: null }),
      trainee_achievements: () => ({ data: [], error: null }),
    }, inserts);

    expect(await new LmsAnalyticsService(supabase, 'org-1').evaluateAchievements('t1')).toEqual([]);
  });
});

describe('getForecast', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when too few modules have been completed recently', async () => {
    const supabase = buildMockSupabase({
      lms_events: () => ({ data: [{ occurred_at: daysAgo(1) }, { occurred_at: daysAgo(2) }], error: null }),
      course_progress: () => ({ data: [{ course_id: 'c1', completed: false }], error: null }),
    });

    expect(await new LmsAnalyticsService(supabase, 'org-1').getForecast('t1')).toBeNull();
  });

  it('returns null when everything happened on one day', async () => {
    // Four completions, but all in one sitting. That is a burst, not a pace.
    const supabase = buildMockSupabase({
      lms_events: () => ({ data: [1, 2, 3, 4].map(() => ({ occurred_at: daysAgo(1) })), error: null }),
      course_progress: () => ({ data: [{ course_id: 'c1', completed: false }], error: null }),
    });

    expect(await new LmsAnalyticsService(supabase, 'org-1').getForecast('t1')).toBeNull();
  });

  it('returns null when there is nothing left to finish', async () => {
    const supabase = buildMockSupabase({
      lms_events: () => ({ data: [
        { occurred_at: daysAgo(1) }, { occurred_at: daysAgo(3) }, { occurred_at: daysAgo(5) },
      ], error: null }),
      course_progress: () => ({ data: [
        { course_id: 'c1', completed: true }, { course_id: 'c1', completed: true },
      ], error: null }),
      courses: () => ({ data: [{ id: 'c1', course_modules: [{ id: 'm1' }, { id: 'm2' }] }], error: null }),
    });

    expect(await new LmsAnalyticsService(supabase, 'org-1').getForecast('t1')).toBeNull();
  });

  it('projects a date from real pace, and flags it as an estimate', async () => {
    const supabase = buildMockSupabase({
      lms_events: () => ({ data: [
        { occurred_at: daysAgo(1) }, { occurred_at: daysAgo(3) },
        { occurred_at: daysAgo(5) }, { occurred_at: daysAgo(7) },
      ], error: null }),
      course_progress: () => ({ data: [
        { course_id: 'c1', completed: true }, { course_id: 'c1', completed: false },
      ], error: null }),
      courses: () => ({ data: [{ id: 'c1', course_modules: [
        { id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }, { id: 'm5' },
      ] }], error: null }),
    });

    const f = await new LmsAnalyticsService(supabase, 'org-1').getForecast('t1');

    expect(f).not.toBeNull();
    expect(f!.modulesRemaining).toBe(4);
    expect(f!.isEstimate).toBe(true);
    expect(f!.estimatedDaysRemaining).toBeGreaterThan(0);
    expect(f!.estimatedCompletionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
