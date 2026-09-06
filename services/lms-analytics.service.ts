import { SupabaseClient } from '@supabase/supabase-js';
import { toGrade, aggregateGrade, type Grade } from '@/lib/lms/grade';

/**
 * LMS engagement — who watched what, how far they got, and where a course loses
 * people.
 *
 * Everything time-shaped reads lms_events (0091), the append-only log added
 * because course_progress overwrites last_accessed_at on every write and
 * therefore cannot answer "how many trainees viewed this video" or "what did
 * activity look like last month".
 */

export interface TimelinePoint {
  date: string;
  views: number;
  completions: number;
  assessments: number;
  activeLearners: number;
  minutes: number;
}

export interface ContentEngagement {
  module_id: string;
  title: string;
  type: string;
  course_title: string;
  views: number;
  viewers: number;
  completions: number;
  avg_progress: number;
  avg_minutes: number;
  /** Share of viewers who did not finish. The drop-off point in a course. */
  dropoff_pct: number;
}

export interface Forecast {
  modulesRemaining: number;
  modulesPerActiveDay: number;
  estimatedDaysRemaining: number;
  estimatedCompletionDate: string;
  basedOnDays: number;
  /** Always true. Present so the UI cannot render this without saying so. */
  isEstimate: true;
}

export class LmsAnalyticsService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  /* --------------------------------------------------------------- timeline */

  async getEngagementTimeline(days = 30): Promise<TimelinePoint[]> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data, error } = await this.supabase
      .from('lms_events')
      .select('event_type, occurred_at, seconds_spent, trainee_id')
      .eq('organization_id', this.orgId)
      .gte('occurred_at', since)
      .order('occurred_at');
    if (error) throw error;

    const byDate = new Map<string, {
      views: number; completions: number; assessments: number;
      seconds: number; learners: Set<string>;
    }>();

    for (const e of data || []) {
      const date = String(e.occurred_at).slice(0, 10);
      const b = byDate.get(date) ?? {
        views: 0, completions: 0, assessments: 0, seconds: 0, learners: new Set<string>(),
      };
      if (e.event_type === 'VIEW_START' || e.event_type === 'VIEW_PROGRESS') b.views++;
      if (e.event_type === 'MODULE_COMPLETE' || e.event_type === 'COURSE_COMPLETE') b.completions++;
      if (e.event_type === 'ASSESSMENT_SUBMIT') b.assessments++;
      b.seconds += e.seconds_spent || 0;
      b.learners.add(e.trainee_id);
      byDate.set(date, b);
    }

    // Days with no activity are omitted rather than zero-filled: a gap in the
    // line is the honest shape of a cohort that did not study that day, and
    // zero-filling would make a quiet week look like a crash.
    return [...byDate.entries()]
      .map(([date, b]) => ({
        date,
        views: b.views,
        completions: b.completions,
        assessments: b.assessments,
        activeLearners: b.learners.size,
        minutes: Math.round(b.seconds / 60),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ------------------------------------------------------ content engagement */

  /** Per-module audience — the "how many viewed this video / PPT" answer. */
  async getContentEngagement(limit = 40): Promise<ContentEngagement[]> {
    const { data: events, error } = await this.supabase
      .from('lms_events')
      .select('module_id, trainee_id, event_type, progress_pct, seconds_spent')
      .eq('organization_id', this.orgId)
      .not('module_id', 'is', null);
    if (error) throw error;
    if (!events?.length) return [];

    const moduleIds = [...new Set(events.map((e) => e.module_id as string))];
    const { data: modules } = await this.supabase
      .from('course_modules')
      .select('id, title, type, courses(title)')
      .in('id', moduleIds);

    const meta = new Map((modules || []).map((m: any) => [m.id, m]));

    const agg = new Map<string, {
      views: number; completions: number; seconds: number;
      pctSum: number; pctCount: number; viewers: Set<string>;
    }>();

    for (const e of events) {
      const id = e.module_id as string;
      const a = agg.get(id) ?? {
        views: 0, completions: 0, seconds: 0, pctSum: 0, pctCount: 0, viewers: new Set<string>(),
      };
      if (e.event_type === 'VIEW_START' || e.event_type === 'VIEW_PROGRESS') a.views++;
      if (e.event_type === 'MODULE_COMPLETE') a.completions++;
      a.seconds += e.seconds_spent || 0;
      if (typeof e.progress_pct === 'number') { a.pctSum += e.progress_pct; a.pctCount++; }
      a.viewers.add(e.trainee_id);
      agg.set(id, a);
    }

    return [...agg.entries()]
      .map(([module_id, a]) => {
        const m = meta.get(module_id);
        const viewers = a.viewers.size;
        return {
          module_id,
          title: m?.title ?? 'Removed module',
          type: m?.type ?? 'UNKNOWN',
          course_title: m?.courses?.title ?? '—',
          views: a.views,
          viewers,
          completions: a.completions,
          avg_progress: a.pctCount ? Math.round(a.pctSum / a.pctCount) : 0,
          avg_minutes: viewers ? Math.round(a.seconds / viewers / 60) : 0,
          // Of the people who opened it, how many never finished.
          dropoff_pct: viewers ? Math.max(0, Math.round(((viewers - a.completions) / viewers) * 100)) : 0,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  /* ------------------------------------------------------- one trainee's view */

  async getTraineeProgress(traineeId: string) {
    const [{ data: progress }, { data: results }, { data: events }, { data: certs }] =
      await Promise.all([
        this.supabase.from('course_progress')
          .select('course_id, module_id, completed, progress_pct, time_spent_seconds')
          .eq('trainee_id', traineeId),
        this.supabase.from('assessment_results')
          .select('id, score, max_score, passed, submitted_at, assessments(title, passing_score, max_score)')
          .eq('trainee_id', traineeId)
          .order('submitted_at', { ascending: false }),
        this.supabase.from('lms_events')
          .select('occurred_at, seconds_spent, event_type')
          .eq('trainee_id', traineeId)
          .order('occurred_at', { ascending: false })
          .limit(2000),
        this.supabase.from('certificates').select('id').eq('trainee_id', traineeId).eq('status', 'ACTIVE'),
      ]);

    const rows = progress || [];
    const courseIds = [...new Set(rows.map((r) => r.course_id))];

    const { data: courses } = courseIds.length
      ? await this.supabase.from('courses').select('id, title, course_modules(id)').in('id', courseIds)
      : { data: [] as any[] };

    const perCourse = (courses || []).map((c: any) => {
      const total = c.course_modules?.length || 0;
      const mine = rows.filter((r) => r.course_id === c.id);
      const done = mine.filter((r) => r.completed).length;
      return {
        course_id: c.id,
        title: c.title,
        total_modules: total,
        completed_modules: done,
        // Against the course's real module count, not against what they have
        // touched — otherwise opening one module of twenty reads as 100%.
        percentage: total ? Math.round((done / total) * 100) : 0,
        minutes: Math.round(mine.reduce((a, r) => a + (r.time_spent_seconds || 0), 0) / 60),
      };
    });

    const gradeRows = (results || []).map((r: any) => ({ score: r.score, max_score: r.max_score }));

    return {
      courses: perCourse,
      modulesCompleted: rows.filter((r) => r.completed).length,
      coursesCompleted: perCourse.filter((c) => c.total_modules > 0 && c.percentage === 100).length,
      totalMinutes: Math.round(rows.reduce((a, r) => a + (r.time_spent_seconds || 0), 0) / 60),
      assessmentsTaken: (results || []).length,
      assessmentsPassed: (results || []).filter((r: any) => r.passed).length,
      certificates: (certs || []).length,
      overallGrade: aggregateGrade(gradeRows),
      recentResults: (results || []).slice(0, 5).map((r: any) => ({
        title: r.assessments?.title ?? 'Assessment',
        submitted_at: r.submitted_at,
        ...toGrade(r.score, r.max_score, this.passingPct(r.assessments)),
      })),
      streak: this.currentStreak((events || []).map((e) => String(e.occurred_at))),
      // Per-day rollup for the heatmap. Done here rather than in a second
      // query because the events are already loaded for the streak.
      dailyActivity: this.rollupByDay(events || []),
      activeDays: new Set((events || []).map((e) => String(e.occurred_at).slice(0, 10))).size,
    };
  }

  /** One row per day the trainee did anything, for the activity heatmap. */
  private rollupByDay(events: { occurred_at: unknown; seconds_spent?: number | null }[]) {
    const byDate = new Map<string, { date: string; views: number; minutes: number }>();
    for (const e of events) {
      const date = String(e.occurred_at).slice(0, 10);
      const b = byDate.get(date) ?? { date, views: 0, minutes: 0 };
      b.views++;
      b.minutes += Math.round((e.seconds_spent || 0) / 60);
      byDate.set(date, b);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** passing_score is stored in marks, not percent; convert once, here. */
  private passingPct(assessment: { passing_score?: number; max_score?: number } | null): number {
    if (!assessment?.passing_score || !assessment?.max_score) return 40;
    return Math.round((assessment.passing_score / assessment.max_score) * 100);
  }

  /**
   * Consecutive days ending today or yesterday. Yesterday still counts —
   * someone who studied last night has not broken a streak just because they
   * have not opened the app yet this morning.
   */
  private currentStreak(timestamps: string[]): number {
    const days = new Set(timestamps.map((t) => t.slice(0, 10)));
    if (!days.size) return 0;

    const dayString = (offset: number) =>
      new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

    let start = 0;
    if (!days.has(dayString(0))) {
      if (!days.has(dayString(1))) return 0;
      start = 1;
    }

    let streak = 0;
    for (let i = start; i < 400; i++) {
      if (!days.has(dayString(i))) break;
      streak++;
    }
    return streak;
  }

  /* ---------------------------------------------------------------- forecast */

  /**
   * Projects a completion date from recent pace. A linear projection over
   * active days, not a model — the caller must label it as an estimate, which
   * is why the return type carries isEstimate.
   */
  async getForecast(traineeId: string, windowDays = 14): Promise<Forecast | null> {
    const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

    const [{ data: recent }, { data: progress }] = await Promise.all([
      this.supabase.from('lms_events')
        .select('occurred_at')
        .eq('trainee_id', traineeId)
        .eq('event_type', 'MODULE_COMPLETE')
        .gte('occurred_at', since),
      this.supabase.from('course_progress')
        .select('course_id, completed')
        .eq('trainee_id', traineeId),
    ]);

    const completedRecently = (recent || []).length;
    const activeDays = new Set((recent || []).map((e) => String(e.occurred_at).slice(0, 10))).size;

    // Two data points is a coincidence, not a pace. Returning null is more
    // useful than a confident number drawn from one afternoon of study.
    if (completedRecently < 3 || activeDays < 2) return null;

    const courseIds = [...new Set((progress || []).map((p) => p.course_id))];
    if (!courseIds.length) return null;

    const { data: courses } = await this.supabase
      .from('courses').select('id, course_modules(id)').in('id', courseIds);

    const totalModules = (courses || []).reduce(
      (a: number, c: any) => a + (c.course_modules?.length || 0), 0,
    );
    const done = (progress || []).filter((p) => p.completed).length;
    const remaining = Math.max(0, totalModules - done);
    if (remaining === 0) return null;

    const perActiveDay = completedRecently / activeDays;
    // Scaled by how often they actually show up, so someone studying two days a
    // week is not projected as if they study daily.
    const studyFrequency = activeDays / windowDays;
    const perCalendarDay = perActiveDay * studyFrequency;
    const daysRemaining = Math.ceil(remaining / Math.max(perCalendarDay, 0.01));

    return {
      modulesRemaining: remaining,
      modulesPerActiveDay: Math.round(perActiveDay * 10) / 10,
      estimatedDaysRemaining: daysRemaining,
      estimatedCompletionDate: new Date(Date.now() + daysRemaining * 86_400_000)
        .toISOString().slice(0, 10),
      basedOnDays: windowDays,
      isEstimate: true,
    };
  }

  /* ------------------------------------------------------------- leaderboard */

  async getLeaderboard(limit = 10) {
    const { data: trainees } = await this.supabase
      .from('trainees')
      .select('id, institution_id, profiles:user_id(full_name), institutions(code)')
      .eq('organization_id', this.orgId)
      .eq('status', 'ACTIVE');
    if (!trainees?.length) return [];

    const ids = trainees.map((t: any) => t.id);
    const [{ data: unlocks }, { data: progress }] = await Promise.all([
      this.supabase.from('trainee_achievements')
        .select('trainee_id, achievements(points)').in('trainee_id', ids),
      this.supabase.from('course_progress')
        .select('trainee_id, completed').in('trainee_id', ids),
    ]);

    return trainees
      .map((t: any) => {
        const points = (unlocks || [])
          .filter((u: any) => u.trainee_id === t.id)
          .reduce((a: number, u: any) => a + (u.achievements?.points || 0), 0);
        const modules = (progress || []).filter((p) => p.trainee_id === t.id && p.completed).length;
        return {
          trainee_id: t.id,
          name: t.profiles?.full_name ?? 'Trainee',
          institution: t.institutions?.code ?? '—',
          badges: (unlocks || []).filter((u: any) => u.trainee_id === t.id).length,
          modules,
          // Completed modules count too, so a diligent learner who has not yet
          // crossed a badge threshold is still visible on the board.
          points: points + modules * 5,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  }

  /* ------------------------------------------------------------ achievements */

  async listAchievements(traineeId?: string) {
    const [{ data: all }, { data: mine }] = await Promise.all([
      this.supabase.from('achievements').select('*').order('sort_order'),
      traineeId
        ? this.supabase.from('trainee_achievements')
            .select('achievement_id, unlocked_at, unlocked_value').eq('trainee_id', traineeId)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const unlocked = new Map((mine || []).map((u: any) => [u.achievement_id, u]));
    // Locked ones are returned too: a shelf with empty slots is what makes the
    // next badge legible as a goal.
    return (all || []).map((a: any) => ({
      ...a,
      unlocked: unlocked.has(a.id),
      unlocked_at: unlocked.get(a.id)?.unlocked_at ?? null,
      unlocked_value: unlocked.get(a.id)?.unlocked_value ?? null,
    }));
  }

  /**
   * Awards anything newly earned and returns it, so a caller can show
   * "you just unlocked …". Idempotent — the UNIQUE constraint plus the
   * already-unlocked filter mean re-running awards nothing twice.
   */
  async evaluateAchievements(traineeId: string) {
    const metrics = await this.achievementMetrics(traineeId);

    const [{ data: all }, { data: existing }] = await Promise.all([
      this.supabase.from('achievements').select('id, code, name, tier, points, criteria'),
      this.supabase.from('trainee_achievements').select('achievement_id').eq('trainee_id', traineeId),
    ]);

    const have = new Set((existing || []).map((e) => e.achievement_id));
    const earned = (all || []).filter((a: any) => {
      if (have.has(a.id)) return false;
      const value = metrics[a.criteria?.metric as keyof typeof metrics];
      return typeof value === 'number' && value >= (a.criteria?.threshold ?? Infinity);
    });

    if (!earned.length) return [];

    const { error } = await this.supabase.from('trainee_achievements').insert(
      earned.map((a: any) => ({
        trainee_id: traineeId,
        achievement_id: a.id,
        unlocked_value: metrics[a.criteria?.metric as keyof typeof metrics] ?? null,
      })),
    );
    // A race with a concurrent write hits the UNIQUE constraint. That means the
    // badge is already awarded, which is the desired end state, so it is not an
    // error worth failing the caller's request for.
    if (error && error.code !== '23505') throw error;

    return earned.map((a: any) => ({ code: a.code, name: a.name, tier: a.tier, points: a.points }));
  }

  private async achievementMetrics(traineeId: string) {
    const [{ data: progress }, { data: results }, { data: certs }, { data: skills }, { data: events }, { data: enrolments }] =
      await Promise.all([
        this.supabase.from('course_progress').select('course_id, completed').eq('trainee_id', traineeId),
        this.supabase.from('assessment_results').select('score, max_score, passed').eq('trainee_id', traineeId),
        this.supabase.from('certificates').select('id').eq('trainee_id', traineeId).eq('status', 'ACTIVE'),
        this.supabase.from('trainee_skills').select('id').eq('trainee_id', traineeId).eq('verified', true),
        this.supabase.from('lms_events').select('occurred_at').eq('trainee_id', traineeId).limit(2000),
        this.supabase.from('enrollments').select('id').eq('trainee_id', traineeId).eq('status', 'COMPLETED'),
      ]);

    const rows = progress || [];
    const courseIds = [...new Set(rows.map((r) => r.course_id))];
    const { data: courses } = courseIds.length
      ? await this.supabase.from('courses').select('id, course_modules(id)').in('id', courseIds)
      : { data: [] as any[] };

    const coursesCompleted = (courses || []).filter((c: any) => {
      const total = c.course_modules?.length || 0;
      if (!total) return false;
      return rows.filter((r) => r.course_id === c.id && r.completed).length >= total;
    }).length;

    return {
      modules_completed: rows.filter((r) => r.completed).length,
      courses_completed: coursesCompleted,
      assessments_passed: (results || []).filter((r) => r.passed).length,
      perfect_scores: (results || []).filter((r) => r.max_score > 0 && r.score >= r.max_score).length,
      certificates: (certs || []).length,
      skills_verified: (skills || []).length,
      streak_days: this.currentStreak((events || []).map((e) => String(e.occurred_at))),
      programmes_completed: (enrolments || []).length,
    };
  }

  /** Appends one event. The only write path into lms_events from the app. */
  async recordEvent(input: {
    traineeId: string; eventType: string;
    courseId?: string; moduleId?: string; assessmentId?: string;
    progressPct?: number; secondsSpent?: number; metadata?: Record<string, unknown>;
  }) {
    const { error } = await this.supabase.from('lms_events').insert({
      organization_id: this.orgId,
      trainee_id: input.traineeId,
      course_id: input.courseId ?? null,
      module_id: input.moduleId ?? null,
      assessment_id: input.assessmentId ?? null,
      event_type: input.eventType,
      progress_pct: input.progressPct ?? null,
      seconds_spent: input.secondsSpent ?? 0,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
  }
}

export type { Grade };
