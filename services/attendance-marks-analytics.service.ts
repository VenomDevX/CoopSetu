import { SupabaseClient } from '@supabase/supabase-js';
import { istDayKey } from '@/lib/attendance/time';

/**
 * Attendance + academic-outcome analytics for the unified analytics page
 * (app/dashboard/analytics/overview). Every method takes an explicit list of
 * trainee ids rather than branching on role internally — the route resolves
 * "which trainees am I allowed to see" once (self / institute / everyone)
 * the same way training-analytics.service.ts resolves institutions, and this
 * service just aggregates whatever ids it's handed. That keeps a self-view
 * (one trainee id) and an institute rollup (hundreds) the same code path.
 *
 * As with TrainingAnalyticsService, every figure comes from real rows —
 * an empty result means no data, never a guess.
 */

export interface AttendanceTrendPoint {
  date: string;
  pct: number;
  marked: number;
}

export interface CourseMarks {
  course_id: string;
  course_title: string;
  avg_score_pct: number;
  attempts: number;
  pass_rate_pct: number;
}

export interface CourseProgressItem {
  course_id: string;
  course_title: string;
  avg_progress_pct: number;
  trainees_tracked: number;
}

export interface CertificateCounts {
  total: number;
  active: number;
  revoked: number;
  expired: number;
}

export class AttendanceMarksAnalyticsService {
  constructor(private supabase: SupabaseClient, private orgId: string) {}

  /** All trainee ids in scope, optionally narrowed to a set of institutions. */
  async traineeIdsForInstitutions(institutionIds?: string[]): Promise<string[]> {
    let q = this.supabase.from('trainees').select('id').eq('organization_id', this.orgId);
    if (institutionIds?.length) q = q.in('institution_id', institutionIds);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((t) => t.id);
  }

  /** Resolve the caller's own trainees.id from their auth user id, or null if they aren't one. */
  async traineeIdForUser(userId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('trainees')
      .select('id')
      .eq('organization_id', this.orgId)
      .eq('user_id', userId)
      .maybeSingle();
    return data?.id ?? null;
  }

  /** Attendance percentage per day over the window, oldest first. */
  async getAttendanceTrend(traineeIds: string[], days = 30): Promise<AttendanceTrendPoint[]> {
    if (!traineeIds.length) return [];
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data, error } = await this.supabase
      .from('attendance_records')
      .select('status, marked_at')
      .in('trainee_id', traineeIds)
      .gte('marked_at', since);
    if (error) throw error;

    const byDate = new Map<string, { present: number; total: number }>();
    for (const r of data || []) {
      const date = istDayKey(r.marked_at as string);
      const bucket = byDate.get(date) || { present: 0, total: 0 };
      bucket.total += 1;
      if (r.status === 'PRESENT' || r.status === 'LATE') bucket.present += 1;
      byDate.set(date, bucket);
    }

    return [...byDate.entries()]
      .map(([date, b]) => ({ date, pct: Math.round((b.present / b.total) * 100), marked: b.total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Overall attendance percentage across all records in scope (no window). */
  async getOverallAttendancePct(traineeIds: string[]): Promise<number | null> {
    if (!traineeIds.length) return null;
    const { data, error } = await this.supabase
      .from('attendance_records')
      .select('status')
      .in('trainee_id', traineeIds);
    if (error) throw error;
    if (!data?.length) return null;
    const present = data.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    return Math.round((present / data.length) * 100);
  }

  /** Average assessment score per course, for the given trainees. */
  async getMarksByCourse(traineeIds: string[]): Promise<CourseMarks[]> {
    if (!traineeIds.length) return [];
    const { data, error } = await this.supabase
      .from('assessment_results')
      .select('score, max_score, passed, assessments(course_id, courses(id, title))')
      .in('trainee_id', traineeIds);
    if (error) throw error;

    const byCourse = new Map<string, { title: string; pctSum: number; count: number; passed: number }>();
    for (const r of (data || []) as any[]) {
      const course = r.assessments?.courses;
      if (!course) continue;
      const pct = r.max_score > 0 ? (r.score / r.max_score) * 100 : 0;
      const bucket = byCourse.get(course.id) || { title: course.title, pctSum: 0, count: 0, passed: 0 };
      bucket.pctSum += pct;
      bucket.count += 1;
      if (r.passed) bucket.passed += 1;
      byCourse.set(course.id, bucket);
    }

    return [...byCourse.entries()]
      .map(([course_id, b]) => ({
        course_id,
        course_title: b.title,
        avg_score_pct: Math.round(b.pctSum / b.count),
        attempts: b.count,
        pass_rate_pct: Math.round((b.passed / b.count) * 100),
      }))
      .sort((a, b) => a.course_title.localeCompare(b.course_title));
  }

  /** Average module-completion progress per course, for the given trainees. */
  async getCourseProgress(traineeIds: string[]): Promise<CourseProgressItem[]> {
    if (!traineeIds.length) return [];
    const { data, error } = await this.supabase
      .from('course_progress')
      .select('progress_pct, trainee_id, courses(id, title)')
      .in('trainee_id', traineeIds);
    if (error) throw error;

    const byCourse = new Map<string, { title: string; pctSum: number; count: number; trainees: Set<string> }>();
    for (const r of (data || []) as any[]) {
      const course = r.courses;
      if (!course) continue;
      const bucket = byCourse.get(course.id) || { title: course.title, pctSum: 0, count: 0, trainees: new Set<string>() };
      bucket.pctSum += r.progress_pct || 0;
      bucket.count += 1;
      bucket.trainees.add(r.trainee_id);
      byCourse.set(course.id, bucket);
    }

    return [...byCourse.entries()]
      .map(([course_id, b]) => ({
        course_id,
        course_title: b.title,
        avg_progress_pct: Math.round(b.pctSum / b.count),
        trainees_tracked: b.trainees.size,
      }))
      .sort((a, b) => a.course_title.localeCompare(b.course_title));
  }

  async getCertificateCounts(traineeIds: string[]): Promise<CertificateCounts> {
    if (!traineeIds.length) return { total: 0, active: 0, revoked: 0, expired: 0 };
    const { data, error } = await this.supabase
      .from('certificates')
      .select('status')
      .in('trainee_id', traineeIds);
    if (error) throw error;
    const rows = data || [];
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === 'ACTIVE').length,
      revoked: rows.filter((r) => r.status === 'REVOKED').length,
      expired: rows.filter((r) => r.status === 'EXPIRED').length,
    };
  }
}
