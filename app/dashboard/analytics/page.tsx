'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  Bot,
  BarChart3,
  Download,
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Share2,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const tabs = [
  'Delivery Analytics',
  'Team Performance',
  'Capacity Planning',
  'Quality Metrics',
  'Release Analytics',
  'Incident Analytics',
  'Compliance Analytics',
  'Executive Reports'
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('Delivery Analytics');
  const [velocityData, setVelocityData] = useState<{ sprint: string; planned: number; completed: number }[]>([]);
  const [projectHealthData, setProjectHealthData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [workStatusData, setWorkStatusData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/sprints').then((r) => r.json()).then((j) => {
      if (!active) return;

      setVelocityData((Array.isArray(j?.data) ? j.data : []).slice(0, 8).map((s: any) => ({
        sprint: s.name, planned: Number(s.planned_story_points) || 0, completed: Number(s.completed_story_points) || 0,
      })));
    }).catch(() => { });

    fetch('/api/v1/analytics/projects').then((r) => r.json()).then((j) => {
      if (!active) return;
      const rows = Array.isArray(j?.data) ? j.data : [];
      const by = (h: string) => rows.filter((p: { health: string }) => p.health === h).length;
      setProjectHealthData([
        { name: 'On Track', value: by('ON_TRACK'), color: 'var(--foreground)' },
        { name: 'At Risk', value: by('AT_RISK'), color: 'var(--muted-foreground)' },
        { name: 'Off Track', value: by('OFF_TRACK'), color: 'var(--border)' },
      ]);
    }).catch(() => { });

    fetch('/api/v1/tasks').then((r) => r.json()).then((j) => {
      if (!active) return;
      const rows = Array.isArray(j?.data) ? j.data : [];
      const grp = { 'To Do': 0, 'In Progress': 0, 'In Review': 0, Done: 0 };
      const map: Record<string, keyof typeof grp> = {
        BACKLOG: 'To Do', READY: 'To Do', IN_PROGRESS: 'In Progress', BLOCKED: 'In Progress',
        CODE_REVIEW: 'In Review', QA_TESTING: 'In Review', SECURITY_REVIEW: 'In Review',
        READY_FOR_RELEASE: 'In Review', DONE: 'Done', CANCELLED: 'Done',
      };
      rows.forEach((t: { status: string }) => { const k = map[t.status]; if (k) grp[k]++; });
      setWorkStatusData(Object.entries(grp).map(([name, value]) => ({ name, value })));
    }).catch(() => { });
    return () => { active = false; };
  }, []);

  // Real, derived delivery metrics (no fabricated baselines).
  const totalPlanned = velocityData.reduce((s, v) => s + v.planned, 0);
  const totalCompleted = velocityData.reduce((s, v) => s + v.completed, 0);
  const avgVelocity = velocityData.length ? Math.round(totalCompleted / velocityData.length) : 0;
  const completionRate = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
  const totalProjects = projectHealthData.reduce((s, p) => s + p.value, 0);
  const onTrackPct = totalProjects > 0
    ? Math.round(((projectHealthData.find((p) => p.name === 'On Track')?.value ?? 0) / totalProjects) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-[calc(100vh-80px)]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Analytics</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Reports</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest max-w-2xl">
            Monitor delivery performance, workload, quality, releases, risk, and organizational capacity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <Printer className="w-4 h-4" />
            Export PDF
          </Button>
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <Calendar className="w-4 h-4" />
            Schedule
          </Button>
          <Button disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background gap-2 disabled:opacity-40">
            <Plus className="w-4 h-4" />
            Create Report
          </Button>
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-accent gap-2 disabled:opacity-40">
            <Bot className="w-4 h-4" />
            Ask Handoff AI
          </Button>
        </div>
      </div>

      {/* Controls & Tabs */}
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-4 text-sm font-mono flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-muted-foreground tracking-widest">Date Range:</span>
            <select disabled title="Not available yet" className="bg-background border border-border px-2 py-1 text-xs focus:outline-none focus:border-foreground uppercase disabled:opacity-40">
              <option>All Time</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-muted-foreground tracking-widest">Team:</span>
            <select disabled title="Not available yet" className="bg-background border border-border px-2 py-1 text-xs focus:outline-none focus:border-foreground uppercase disabled:opacity-40">
              <option>All Teams</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-muted-foreground tracking-widest">Compare:</span>
            <select disabled title="Not available yet" className="bg-background border border-border px-2 py-1 text-xs focus:outline-none focus:border-foreground uppercase disabled:opacity-40">
              <option>None</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors border ${activeTab === tab
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-surface text-muted-foreground border-transparent hover:border-border hover:text-foreground'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6 pb-12">
        {activeTab === 'Delivery Analytics' && (
          <div className="space-y-6 animate-in fade-in">

            {/* Top KPIs — derived from real sprint/project data */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="border border-border p-5 bg-surface flex flex-col justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Avg Sprint Velocity</div>
                <div className="text-3xl font-bold font-mono tracking-tight">{avgVelocity} pts</div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground mt-2">
                  <span>Across {velocityData.length} sprint{velocityData.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="border border-border p-5 bg-surface flex flex-col justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Completion Rate</div>
                <div className="text-3xl font-bold font-mono tracking-tight">{completionRate}%</div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground mt-2">
                  <span>{totalCompleted}/{totalPlanned} story points</span>
                </div>
              </div>
              <div className="border border-border p-5 bg-surface flex flex-col justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Projects On Track</div>
                <div className="text-3xl font-bold font-mono tracking-tight">{onTrackPct}%</div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground mt-2">
                  <span>{projectHealthData.find((p) => p.name === 'On Track')?.value ?? 0}/{totalProjects} projects</span>
                </div>
              </div>
              <div className="border border-border p-5 bg-surface flex flex-col justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Average Cycle Time</div>
                <div className="text-xl font-bold tracking-tight text-muted-foreground">—</div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground mt-2">
                  <span>Not tracked yet</span>
                </div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sprint Velocity Chart */}
              <div className="border border-border p-5 bg-surface">
                <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Sprint Velocity Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocityData} margin={{ left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="sprint" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }}
                        cursor={{ fill: 'var(--surface-hover)' }}
                      />
                      <Bar dataKey="planned" name="Planned" fill="var(--border)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="var(--foreground)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cycle Time Trend — no historical cycle-time series tracked yet */}
              <div className="border border-border p-5 bg-surface">
                <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Cycle Time Trend (Days)</h3>
                <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-border bg-surface/40">
                  <Clock className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="text-xs font-mono text-muted-foreground">Cycle-time history not available yet.</p>
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Project Health */}
              <div className="border border-border p-5 bg-surface col-span-1">
                <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Project Health</h3>
                <div className="h-48 flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectHealthData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {projectHealthData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px', color: 'var(--foreground)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-2xl font-bold font-mono">{onTrackPct}%</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">On Track</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4 mt-2">
                  {projectHealthData.map(entry => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-[10px] font-mono uppercase">
                      <div className="w-2 h-2" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Work By Status */}
              <div className="border border-border p-5 bg-surface col-span-2">
                <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-6">Work by Status</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workStatusData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--foreground)' }} width={80} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '0', fontSize: '12px' }}
                        cursor={{ fill: 'var(--surface-hover)' }}
                      />
                      <Bar dataKey="value" name="Issues" fill="var(--muted-foreground)" radius={[0, 2, 2, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab !== 'Delivery Analytics' && (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border bg-surface/50 animate-in fade-in">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">{activeTab}</h3>
            <p className="text-sm text-muted-foreground max-w-sm font-mono">
              Not available yet.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
