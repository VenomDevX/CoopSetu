'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { Award, CalendarCheck, GraduationCap, Percent } from 'lucide-react';
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';

/**
 * Single-page attendance + academic-outcome view, backed by
 * /api/v1/analytics/overview. The API resolves scope server-side (self /
 * institution / national) — this component just renders whatever comes back
 * and, for a national caller, offers a dropdown to drill into one institute.
 */

interface AttendanceTrendPoint { date: string; pct: number; marked: number }
interface CourseMarks { course_id: string; course_title: string; avg_score_pct: number; attempts: number; pass_rate_pct: number }
interface CourseProgressItem { course_id: string; course_title: string; avg_progress_pct: number; trainees_tracked: number }
interface CertificateCounts { total: number; active: number; revoked: number; expired: number }
interface Institution { id: string; name: string }
interface AttendanceAnalytics {
  byCourse: Array<{ id: string; title: string; present: number; total: number; pct: number }>;
  byMethod: Array<{ method: string; count: number }>;
  byDevice: Array<{ id: string; name: string; count: number }>;
  absentDays: Array<{ date: string; count: number }>;
  summary: { totalRecords: number; totalPresent: number; totalAbsent: number; overallPct: number };
}

interface OverviewData {
  scope: 'SELF' | 'INSTITUTION' | 'NATIONAL';
  institutions?: Institution[];
  traineeCount?: number;
  overallAttendancePct: number | null;
  attendanceTrend: AttendanceTrendPoint[];
  marksByCourse: CourseMarks[];
  progress: CourseProgressItem[];
  certificates: CertificateCounts;
}

export function AttendanceMarksOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceAnalytics | null>(null);
  const [error, setError] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('');

  const load = useCallback((institutionId?: string) => {
    const qs = institutionId ? `?institution_id=${encodeURIComponent(institutionId)}` : '';
    Promise.all([
      fetch(`/api/v1/analytics/overview${qs}`).then((r) => r.json()),
      fetch(`/api/v1/analytics/attendance${qs}`).then((r) => r.json()),
    ]).then(([overview, attendanceResult]) => {
      if (overview?.error || attendanceResult?.error) {
        setError(overview?.error || attendanceResult?.error);
        return;
      }
      setError('');
      setData(overview?.data || null);
      setAttendance(attendanceResult?.data || null);
    }).catch(() => setError('Failed to load analytics'));
  }, []);

  useEffect(() => { load(); }, [load]);
  useAttendanceRealtime(useCallback(() => load(institutionFilter || undefined), [institutionFilter, load]));

  if (error) {
    return (
      <div className="border border-red-500/40 bg-red-500/10 text-red-500 rounded px-4 py-3 text-sm font-mono">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-border rounded bg-surface/40 font-mono text-xs text-muted-foreground">
        Loading attendance &amp; marks…
      </div>
    );
  }

  const scopeLabel = data.scope === 'SELF' ? 'Your record'
    : data.scope === 'NATIONAL' ? 'Organization-wide' : 'Your institution';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {scopeLabel}
          {typeof data.traineeCount === 'number' && ` · ${data.traineeCount} trainee${data.traineeCount === 1 ? '' : 's'}`}
        </div>

        {data.scope === 'NATIONAL' && data.institutions && data.institutions.length > 0 && (
          <select
            className="border border-border rounded bg-background px-2 py-1 text-xs font-mono uppercase tracking-widest"
            value={institutionFilter}
            onChange={(e) => { setInstitutionFilter(e.target.value); load(e.target.value || undefined); }}
          >
            <option value="">All institutions</option>
            {data.institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-border rounded p-4 bg-surface">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            <Percent className="w-3.5 h-3.5" /> Attendance
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {data.overallAttendancePct !== null ? `${data.overallAttendancePct}%` : '—'}
          </div>
        </div>
        <div className="border border-border rounded p-4 bg-surface">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            <GraduationCap className="w-3.5 h-3.5" /> Courses Tracked
          </div>
          <div className="text-2xl font-bold tabular-nums">{data.marksByCourse.length}</div>
        </div>
        <div className="border border-border rounded p-4 bg-surface">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            <CalendarCheck className="w-3.5 h-3.5" /> Days Marked
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {data.attendanceTrend.reduce((s, p) => s + p.marked, 0)}
          </div>
        </div>
        <div className="border border-border rounded p-4 bg-surface">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            <Award className="w-3.5 h-3.5" /> Certificates
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {data.certificates.active}
            <span className="text-xs text-muted-foreground font-normal"> / {data.certificates.total}</span>
          </div>
        </div>
      </div>

      {/* Attendance trend */}
      <section className="border border-border rounded p-5 bg-surface">
        <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Attendance Trend</h3>
        {data.attendanceTrend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs font-mono text-muted-foreground border border-dashed border-border">
            No attendance recorded in this window.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.attendanceTrend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="pct" name="Attendance %" stroke="var(--foreground)" fill="var(--foreground)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {attendance && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="border border-border rounded p-5 bg-surface">
              <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Attendance by Course</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance.byCourse} layout="vertical" margin={{ left: 12, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <YAxis type="category" dataKey="title" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }} />
                    <Bar dataKey="pct" name="Attendance %" fill="var(--chart-2, var(--foreground))" radius={[0, 2, 2, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="border border-border rounded p-5 bg-surface">
              <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Absent Days</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance.absentDays} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }} />
                    <Bar dataKey="count" name="Absent" fill="var(--destructive)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="border border-border rounded p-5 bg-surface">
              <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Check-ins by Method</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance.byMethod} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="method" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }} />
                    <Bar dataKey="count" name="Check-ins" fill="var(--chart-3, var(--foreground))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="border border-border rounded p-5 bg-surface">
              <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Check-ins by Device</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance.byDevice} layout="vertical" margin={{ left: 12, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }} />
                    <Bar dataKey="count" name="Check-ins" fill="var(--chart-4, var(--foreground))" radius={[0, 2, 2, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}

      {/* Marks by course + progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border border-border rounded p-5 bg-surface">
          <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Marks by Course</h3>
          {data.marksByCourse.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-mono text-muted-foreground border border-dashed border-border">
              No assessment results yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.marksByCourse} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis type="category" dataKey="course_title" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }}
                    cursor={{ fill: 'var(--surface-hover)' }}
                  />
                  <Bar dataKey="avg_score_pct" name="Avg Score %" fill="var(--foreground)" radius={[0, 2, 2, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="border border-border rounded p-5 bg-surface">
          <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Course Progress</h3>
          {data.progress.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-mono text-muted-foreground border border-dashed border-border">
              No progress tracked yet.
            </div>
          ) : (
            <div className="space-y-3">
              {data.progress.map((p) => (
                <div key={p.course_id}>
                  <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    <span>{p.course_title}</span>
                    <span>{p.avg_progress_pct}%</span>
                  </div>
                  <div className="h-2 rounded bg-border overflow-hidden">
                    <div className="h-full bg-foreground" style={{ width: `${p.avg_progress_pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
