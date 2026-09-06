'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  Flame, Clock, BookOpen, Award, TrendingUp, AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useIsNative } from '@/components/native/native-provider';
import { ProgressRing } from '@/components/learning/progress-ring';
import { GradeBadge } from '@/components/learning/grade-badge';
import { AchievementShelf, type AchievementRow } from '@/components/learning/achievement-shelf';
import { ActivityHeatmap, type HeatmapDay } from '@/components/learning/activity-heatmap';
import { gradeColor, type Grade } from '@/lib/lms/grade';

/**
 * A trainee's own learning record.
 *
 * Everything here is derived from what they actually did — lms_events and
 * course_progress — rather than being a set of tiles wired to placeholder
 * numbers. Where there is not enough history for a figure (the pace estimate
 * in particular) the page says so instead of inventing one.
 */

interface CourseRow {
  course_id: string;
  title: string;
  total_modules: number;
  completed_modules: number;
  percentage: number;
  minutes: number;
}

interface Progress {
  courses: CourseRow[];
  modulesCompleted: number;
  coursesCompleted: number;
  totalMinutes: number;
  assessmentsTaken: number;
  assessmentsPassed: number;
  certificates: number;
  overallGrade: Grade | null;
  recentResults: (Grade & { title: string; submitted_at: string })[];
  streak: number;
  activeDays: number;
  dailyActivity: HeatmapDay[];
}

interface Forecast {
  modulesRemaining: number;
  modulesPerActiveDay: number;
  estimatedDaysRemaining: number;
  estimatedCompletionDate: string;
  basedOnDays: number;
  isEstimate: true;
}

export default function MyLearningPage() {
  const isNative = useIsNative();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState('');
  // Starts true, and only ever goes false — the effect must not set state
  // synchronously, so there is no setLoading(true) at the top of load().
  const [loading, setLoading] = useState(true);

  // Non-async callback with .then(): an awaited setState inside an effect is
  // what react-hooks/set-state-in-effect flags, and this is the shape the rest
  // of the dashboard already uses to stay clear of it.
  const load = useCallback(() => {
    fetch('/api/v1/lms/progress')
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setError(j?.error || 'Could not load your learning record.');
          return;
        }
        setProgress(j.data.progress);
        setAchievements(j.data.achievements ?? []);
        setForecast(j.data.forecast ?? null);
        setError('');
      })
      .catch((e) => setError(e?.message ?? 'Could not reach the server.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const overall = progress?.courses.length
    ? Math.round(
        progress.courses.reduce((a, c) => a + c.percentage, 0) / progress.courses.length,
      )
    : 0;

  const hours = progress ? Math.floor(progress.totalMinutes / 60) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="border-b border-border pb-6"
      >
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
          Learning_LMS // My Learning
        </div>
        {!isNative && (
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">My Learning</h1>
        )}
        <p className="text-sm text-muted-foreground mt-2 font-mono">
          Your progress, grades and badges — built from what you have actually watched and completed
        </p>
      </motion.div>

      {error && (
        <div className="border border-red-500/40 bg-red-500/5 rounded p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-red-500">{error}</p>
        </div>
      )}

      {loading && !progress && (
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Loading…</p>
      )}

      {progress && (
        <>
          {/* ------------------------------------------------- headline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <Card className="shadow-none border-border rounded bg-background lg:col-span-1">
              <CardContent className="p-6 flex items-center gap-6">
                <div className={progress.overallGrade ? gradeColor(progress.overallGrade.letter).split(' ')[1] : 'text-accent'}>
                  <ProgressRing value={overall} label="Overall" />
                </div>
                <div className="space-y-3 min-w-0">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Grade</div>
                    <div className="mt-1"><GradeBadge grade={progress.overallGrade} /></div>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {progress.coursesCompleted} of {progress.courses.length} courses finished
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat icon={<Flame className="w-4 h-4" />} label="Day streak" value={progress.streak} />
              <Stat icon={<BookOpen className="w-4 h-4" />} label="Modules done" value={progress.modulesCompleted} />
              <Stat icon={<Clock className="w-4 h-4" />} label="Hours learned" value={hours} />
              <Stat icon={<Award className="w-4 h-4" />} label="Certificates" value={progress.certificates} />
            </div>
          </motion.div>

          {/* ------------------------------------------------- forecast */}
          <Card className="shadow-none border-border rounded bg-background">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                <TrendingUp className="w-3.5 h-3.5" /> Pace estimate
              </div>
              {forecast ? (
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
                  <div>
                    <div className="text-3xl font-bold tracking-tighter tabular-nums text-foreground">
                      {forecast.estimatedCompletionDate}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                      Projected finish
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground leading-relaxed max-w-prose">
                    {forecast.modulesRemaining} modules left, at {forecast.modulesPerActiveDay} per study
                    day over the last {forecast.basedOnDays} days — about {forecast.estimatedDaysRemaining} days.
                    {' '}
                    {/* Said plainly: this is arithmetic on recent pace, not a model. */}
                    <span className="text-yellow-500">
                      This is a straight-line estimate from your recent pace, not a prediction.
                    </span>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-xs text-muted-foreground max-w-prose leading-relaxed">
                  Not enough recent activity to estimate a finish date yet. Complete a few
                  modules across a few days and an estimate will appear here.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------------- activity */}
          <Card className="shadow-none border-border rounded bg-background">
            <CardContent className="p-6">
              <ActivityHeatmap days={progress.dailyActivity ?? []} />
            </CardContent>
          </Card>

          {/* ------------------------------------------------- courses */}
          <div className="space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Courses
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progress.courses.map((c) => (
                <Link
                  key={c.course_id}
                  href={`/dashboard/courses/${c.course_id}`}
                  className="border border-border rounded bg-background p-5 space-y-3 hover:border-foreground transition-colors block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-bold tracking-tight text-foreground">{c.title}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                      {c.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded overflow-hidden">
                    <div className="h-full bg-accent rounded" style={{ width: `${c.percentage}%` }} />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                    {c.completed_modules} / {c.total_modules} modules · {c.minutes} min
                  </div>
                </Link>
              ))}
              {!progress.courses.length && (
                <p className="font-mono text-xs text-muted-foreground">
                  You are not enrolled on a course yet.
                </p>
              )}
            </div>
          </div>

          {/* ------------------------------------------------- results */}
          {progress.recentResults.length > 0 && (
            <div className="space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Recent assessments · {progress.assessmentsPassed} of {progress.assessmentsTaken} passed
              </span>
              <div className="border border-border rounded overflow-hidden">
                {progress.recentResults.map((r, i) => (
                  <div
                    key={`${r.title}-${i}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">{r.title}</div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {new Date(r.submitted_at).toLocaleDateString()}
                      </div>
                    </div>
                    <GradeBadge grade={r} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------- badges */}
          {achievements.length > 0 && (
            <Card className="shadow-none border-border rounded bg-background">
              <CardContent className="p-6">
                <AchievementShelf achievements={achievements} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
          <div className="p-1.5 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">
            {icon}
          </div>
        </div>
        <div className="text-3xl font-bold text-foreground tracking-tighter tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
