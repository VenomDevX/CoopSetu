'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, Flame, Percent, UserCheck } from 'lucide-react';
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';

interface PersonData {
  member: { id: string; name: string; email: string | null };
  stats: {
    totalRecords: number;
    presentCount: number;
    overallPct: number | null;
    streak: number;
    absentCount: number;
    lastPerfectDay: string | null;
  };
  daySeries: { date: string; present: number; late: number; absent: number; total: number }[];
  courseBreakdown: { courseId: string; courseTitle: string; pct: number; total: number }[];
  recentFeed: { id: string; method: string; status: string; markedAt: string; batchName: string | null }[];
}

function time(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
}

export default function AttendancePersonPage() {
  const params = useParams<{ memberId: string }>();
  const [data, setData] = useState<PersonData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/attendance/people/${encodeURIComponent(params.memberId)}?days=60`);
    const json = await response.json();
    if (!response.ok) {
      setError(json?.error?.message || 'Attendance could not be loaded');
      return;
    }
    setError('');
    setData(json.data);
  }, [params.memberId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useAttendanceRealtime(load);

  if (error) return <div className="border border-red-500/40 p-4 text-sm text-red-500">{error}</div>;
  if (!data) return <div className="py-20 text-center text-sm text-muted-foreground">Loading attendance...</div>;

  const kpis = [
    { label: 'Attendance', value: data.stats.overallPct === null ? '-' : `${data.stats.overallPct}%`, icon: Percent },
    { label: 'Classes attended', value: data.stats.presentCount, icon: UserCheck },
    { label: 'Classes absent', value: data.stats.absentCount, icon: CalendarCheck },
    { label: 'Current streak', value: `${data.stats.streak} days`, icon: Flame },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-24">
      <header className="border-b border-border pb-6">
        <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">Attendance / Person</div>
        <h1 className="text-3xl font-bold text-foreground">{data.member.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.member.email || 'Member attendance record'}</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="border border-border bg-background p-4 rounded">
            <div className="mb-3 flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-mono uppercase">{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-border p-5 rounded">
          <h2 className="mb-5 text-xs font-mono font-bold uppercase">Daily attendance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daySeries}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--background)', borderColor: 'var(--border)' }} />
                <Area type="monotone" dataKey="present" stackId="a" stroke="var(--chart-2)" fill="var(--chart-2)" />
                <Area type="monotone" dataKey="late" stackId="a" stroke="var(--chart-4)" fill="var(--chart-4)" />
                <Area type="monotone" dataKey="absent" stackId="a" stroke="var(--destructive)" fill="var(--destructive)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="border border-border p-5 rounded">
          <h2 className="mb-5 text-xs font-mono font-bold uppercase">By course</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.courseBreakdown} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="courseTitle" width={120} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--background)', borderColor: 'var(--border)' }} />
                <Bar dataKey="pct" fill="var(--foreground)" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase">Recent attendance</h2>
          <span className="text-xs text-muted-foreground">Last complete day: {data.stats.lastPerfectDay || '-'}</span>
        </div>
        <div className="divide-y divide-border border border-border rounded">
          {data.recentFeed.map(item => (
            <div key={item.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_100px_120px_180px]">
              <span>{item.batchName || 'Staff day check-in'}</span>
              <span className="font-mono text-xs">{item.method}</span>
              <span className="font-mono text-xs">{item.status}</span>
              <span className="font-mono text-xs text-muted-foreground">{time(item.markedAt)}</span>
            </div>
          ))}
          {data.recentFeed.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No attendance recorded.</div>}
        </div>
      </section>
    </div>
  );
}
