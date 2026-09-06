'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { AlertTriangle, Building2, MapPin, TrendingDown, Users } from 'lucide-react';

/**
 * The training-domain replacement for the inherited delivery analytics.
 *
 * /dashboard/analytics showed institute admins sprint velocity, release
 * analytics and incident MTTR — none of which is about training. Everything
 * here comes from /api/v1/analytics/training, which scopes itself through the
 * caller's own session, so an ICM principal sees their institute and the NCCT
 * director sees the country.
 */

interface Funnel {
  registered: number; nominated: number; enrolled: number;
  completed: number; certified: number; employed: number;
}
interface Data {
  funnel: Funnel;
  attendanceTrend: { date: string; pct: number; marked: number }[];
  dropoutRisk: { trainee_id: string; name: string; attendance_pct: number | null; modules_completed: number; reasons: string[] }[];
  institutions: { id: string; name: string; code: string; level: string; state?: string; trainees: number; programmes: number; certificates: number; utilisation_pct: number | null }[];
  geography: { state: string; trainees: number }[];
}

const FUNNEL_STAGES: { key: keyof Funnel; label: string }[] = [
  { key: 'registered', label: 'Registered' },
  { key: 'nominated', label: 'Nominated' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'completed', label: 'Completed' },
  { key: 'certified', label: 'Certified' },
  { key: 'employed', label: 'Employed' },
];

export function TrainingAnalytics() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/v1/analytics/training').then((r) => r.json()).then((j) => {
      if (j?.error) { setError(j.error); return; }
      setData(j?.data || null);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

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
        Loading training analytics…
      </div>
    );
  }

  const f = data.funnel;
  const funnelRows = FUNNEL_STAGES.map((s) => ({ stage: s.label, count: f[s.key] }));
  // Conversion is measured against the top of the funnel, so each bar reads as
  // "share of everyone who registered" rather than against the previous stage,
  // which would hide compounding drop-off.
  const pctOf = (n: number) => (f.registered ? Math.round((n / f.registered) * 100) : 0);

  return (
    <div className="space-y-8">
      {/* Funnel */}
      <section className="border border-border rounded p-5 bg-surface">
        <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-1">
          Trainee journey
        </h3>
        <p className="font-mono text-[10px] text-muted-foreground mb-6">
          Registered → certified → employed. Percentages are of everyone registered.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {FUNNEL_STAGES.map((s) => (
            <div key={s.key} className="border border-border rounded p-3 bg-background">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {s.label}
              </div>
              <div className="text-2xl font-bold tracking-tighter tabular-nums">{f[s.key]}</div>
              <div className="font-mono text-[10px] text-accent mt-1">{pctOf(f[s.key])}%</div>
            </div>
          ))}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelRows} layout="vertical" margin={{ left: 10, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" width={86} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }}
                cursor={{ fill: 'var(--surface-hover)' }}
              />
              <Bar dataKey="count" name="Trainees" fill="var(--foreground)" radius={[0, 2, 2, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance trend */}
        <section className="border border-border rounded p-5 bg-surface">
          <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">
            Attendance, last 30 days
          </h3>
          {data.attendanceTrend.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.attendanceTrend} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} dy={8} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="pct" name="Present %" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty icon={<TrendingDown className="w-8 h-8" />} label="No attendance marked in the last 30 days." />
          )}
        </section>

        {/* Geography */}
        <section className="border border-border rounded p-5 bg-surface">
          <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">
            <MapPin className="w-3 h-3 inline mr-1" /> Reach by state
          </h3>
          {data.geography.length ? (
            <div className="space-y-2">
              {data.geography.map((g) => {
                const max = Math.max(...data.geography.map((x) => x.trainees), 1);
                return (
                  <div key={g.state} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-xs text-foreground">{g.state}</span>
                    <span className="flex-1 h-2 bg-background rounded-full overflow-hidden border border-border">
                      <span className="block h-full bg-accent" style={{ width: `${(g.trainees / max) * 100}%` }} />
                    </span>
                    <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {g.trainees}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon={<MapPin className="w-8 h-8" />} label="No trainees attributed to a state yet." />
          )}
        </section>
      </div>

      {/* Institutions */}
      <section className="border border-border rounded p-5 bg-surface">
        <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">
          <Building2 className="w-3 h-3 inline mr-1" /> Institutes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                {['Institute', 'Level', 'Trainees', 'Programmes', 'Certificates', 'Utilisation'].map((h) => (
                  <th key={h} className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-medium pb-2 pr-4 border-b border-border-strong whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.institutions.map((i) => (
                <tr key={i.id}>
                  <td className="py-2.5 pr-4 border-b border-border">
                    <span className="text-foreground">{i.name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{i.code}</span>
                  </td>
                  <td className="py-2.5 pr-4 border-b border-border font-mono text-[10px] uppercase text-muted-foreground">{i.level}</td>
                  <td className="py-2.5 pr-4 border-b border-border tabular-nums">{i.trainees}</td>
                  <td className="py-2.5 pr-4 border-b border-border tabular-nums">{i.programmes}</td>
                  <td className="py-2.5 pr-4 border-b border-border tabular-nums">{i.certificates}</td>
                  <td className="py-2.5 border-b border-border tabular-nums">
                    {/* Capacity 0 means uncapped, so utilisation is genuinely
                        undefined rather than 0% or infinite. */}
                    {i.utilisation_pct === null ? <span className="text-muted-foreground">—</span> : `${i.utilisation_pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drop-out risk */}
      <section className="border border-border rounded p-5 bg-surface">
        <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-1">
          <AlertTriangle className="w-3 h-3 inline mr-1" /> Needs attention
        </h3>
        <p className="font-mono text-[10px] text-muted-foreground mb-5">
          Enrolled trainees showing drop-out signals, with the reason shown so it can be disagreed with.
        </p>
        {data.dropoutRisk.length ? (
          <div className="space-y-2">
            {data.dropoutRisk.map((r) => (
              <div key={r.trainee_id} className="flex flex-wrap items-center gap-3 border border-border rounded px-3 py-2.5 bg-background">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">{r.name}</span>
                {r.reasons.map((reason) => (
                  <span key={reason} className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-yellow-500/40 text-yellow-500 bg-yellow-500/10 rounded">
                    {reason}
                  </span>
                ))}
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {r.modules_completed} module{r.modules_completed === 1 ? '' : 's'} done
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={<Users className="w-8 h-8" />} label="No enrolled trainee is showing drop-out signals." />
        )}
      </section>
    </div>
  );
}

function Empty({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="h-40 flex flex-col items-center justify-center text-center border border-dashed border-border bg-surface/40 rounded">
      <span className="text-muted-foreground mb-3">{icon}</span>
      <p className="text-xs font-mono text-muted-foreground">{label}</p>
    </div>
  );
}
