'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Eye, TrendingDown, Trophy, Users } from 'lucide-react';

/**
 * Who is actually watching the material.
 *
 * The question "how many trainees viewed this video / this PPT" had no answer
 * before 0091: course_progress keeps one mutable row per trainee and module and
 * overwrites last_accessed_at, so there was no history to count. This reads the
 * event log instead, through the caller's own session — an ICM principal sees
 * their institute's viewing, the NCCT director sees the network's.
 */

interface TimelinePoint {
  date: string; views: number; completions: number;
  assessments: number; activeLearners: number; minutes: number;
}
interface ContentRow {
  module_id: string; title: string; type: string; course_title: string;
  views: number; viewers: number; completions: number;
  avg_progress: number; avg_minutes: number; dropoff_pct: number;
}
interface LeaderRow {
  trainee_id: string; name: string; institution: string;
  badges: number; modules: number; points: number;
}

const TYPE_STYLE: Record<string, string> = {
  VIDEO:        'border-blue-500/40 text-blue-500',
  PPT:          'border-orange-500/40 text-orange-500',
  PRESENTATION: 'border-orange-500/40 text-orange-500',
  PDF:          'border-red-500/40 text-red-500',
  DOCUMENT:     'border-red-500/40 text-red-500',
  QUIZ:         'border-purple-500/40 text-purple-500',
  TEXT:         'border-border text-muted-foreground',
};

export function LmsEngagement() {
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/v1/lms/analytics?days=90').then((r) => r.json()).then((j) => {
      if (j?.error) { setError(j.error); return; }
      setTimeline(j?.data?.timeline ?? []);
      setContent(j?.data?.content ?? []);
      setLeaderboard(j?.data?.leaderboard ?? []);
    }).catch((e) => setError(e?.message ?? 'Could not load engagement data.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="border border-red-500/40 bg-red-500/10 text-red-500 rounded px-4 py-3 text-sm font-mono">
        {error}
      </div>
    );
  }

  const totalViews = timeline.reduce((a, p) => a + p.views, 0);
  const totalMinutes = timeline.reduce((a, p) => a + p.minutes, 0);
  const peakLearners = timeline.reduce((a, p) => Math.max(a, p.activeLearners), 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icon={<Eye className="w-4 h-4" />} label="Views · 90 days" value={totalViews.toLocaleString()} />
        <Tile icon={<Users className="w-4 h-4" />} label="Peak daily learners" value={peakLearners} />
        <Tile icon={<Trophy className="w-4 h-4" />} label="Hours watched" value={Math.round(totalMinutes / 60).toLocaleString()} />
        <Tile
          icon={<TrendingDown className="w-4 h-4" />}
          label="Worst drop-off"
          value={content.length ? `${Math.max(...content.map((c) => c.dropoff_pct))}%` : '—'}
        />
      </div>

      {/* ------------------------------------------------------- timeline */}
      <div className="border border-border rounded bg-background p-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
          Daily viewing · last 90 days
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {/* Colours come from CSS variables so the chart follows the
                viewer's theme without a resolvedTheme round trip. */}
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="lmsViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickMargin={8} minTickGap={28} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} width={36} />
              <RechartsTooltip
                contentStyle={{
                  background: 'var(--background)', border: '1px solid var(--border)',
                  borderRadius: 4, fontFamily: 'monospace', fontSize: 11,
                }}
              />
              <Area type="monotone" dataKey="views" stroke="var(--accent)" strokeWidth={2} fill="url(#lmsViews)" name="Views" />
              <Area type="monotone" dataKey="activeLearners" stroke="var(--muted-foreground)" strokeWidth={1.5} fill="none" name="Active learners" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* -------------------------------------------------------- content */}
      <div className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Content engagement · most viewed first
        </div>
        <div className="border border-border rounded overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-4 py-3">Module</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Views</th>
                <th className="text-right px-4 py-3">Viewers</th>
                <th className="text-right px-4 py-3">Finished</th>
                <th className="text-right px-4 py-3">Avg reach</th>
                <th className="text-right px-4 py-3">Drop-off</th>
              </tr>
            </thead>
            <tbody>
              {content.map((c) => (
                <tr key={c.module_id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="text-foreground">{c.title}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.course_title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] uppercase tracking-widest border rounded px-1.5 py-0.5 ${TYPE_STYLE[c.type] ?? 'border-border text-muted-foreground'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c.views}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c.viewers}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c.completions}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c.avg_progress}%</td>
                  <td className="px-4 py-3 text-right">
                    {/* A high drop-off is where a course loses people, so it
                        reads as a warning rather than another number. */}
                    <span className={`font-mono tabular-nums ${
                      c.dropoff_pct >= 50 ? 'text-red-500' : c.dropoff_pct >= 25 ? 'text-yellow-500' : 'text-muted-foreground'
                    }`}>
                      {c.dropoff_pct}%
                    </span>
                  </td>
                </tr>
              ))}
              {!content.length && (
                <tr><td colSpan={7} className="px-4 py-6 font-mono text-xs text-muted-foreground">No viewing recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------- leaderboard */}
      {leaderboard.length > 0 && (
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Leaderboard
          </div>
          <div className="border border-border rounded">
            {leaderboard.map((l, i) => (
              <div key={l.trainee_id} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0">
                <span className="font-mono text-xs tabular-nums text-muted-foreground w-6">{i + 1}</span>
                <span className="flex-1 text-sm text-foreground truncate">{l.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{l.institution}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                  {l.modules} modules · {l.badges} badges
                </span>
                <span className="font-mono text-sm tabular-nums text-foreground w-16 text-right">{l.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="border border-border rounded bg-background p-5">
      <div className="flex items-center justify-between text-muted-foreground mb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold tracking-tighter tabular-nums text-foreground">{value}</div>
    </div>
  );
}
