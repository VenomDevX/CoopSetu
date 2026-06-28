'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Terminal, AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { usePermission } from "@/lib/permissions/context";
import { EmployeeOverview } from "@/components/dashboard/employee-overview";
import { useTablesRealtime } from "@/hooks/use-tables-realtime";
import { useCallback } from "react";
import Link from "next/link";

interface OverviewMetrics {
  activeProjects: number; projectsAtRisk: number; overdueTasks: number;
  openTasks: number; blockedTasks: number; completion: number;
  totalTasks: number; doneTasks: number; unreadNotifications: number;
}

interface OverviewSignal {
  kind: string; severity: 'critical' | 'high' | 'medium';
  count: number; label: string; href: string;
}
interface PriorityItem {
  identifier: string; cls: string; project: string; state: string; owner: string; href: string;
}
interface OverviewData {
  metrics: OverviewMetrics;
  signals: OverviewSignal[];
  priorityItems: PriorityItem[];
  velocity: { name: string; points: number }[];
  workload: { name: string; open: number }[];
}

export default function ExecutiveDashboard() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const { has } = usePermission();
  const canViewAnalytics = has('analytics:view');
  const metrics = overview?.metrics ?? null;

  const load = useCallback(() => {
    if (!canViewAnalytics) return;
    fetch('/api/v1/analytics/overview')
      .then((r) => r.json())
      .then((j) => j?.data && setOverview(j.data))
      .catch(() => { });
  }, [canViewAnalytics]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    load();
  }, [load]);

  // Live-refresh the executive overview as the underlying data changes.
  useTablesRealtime(['tasks', 'incidents', 'approval_requests', 'bugs'], load);

  const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');

  const chartColor = mounted && resolvedTheme === 'dark' ? '#F5F5F5' : '#111111';
  const gridColor = mounted && resolvedTheme === 'dark' ? '#2A2A2A' : '#E2E2E2';
  const textColor = mounted && resolvedTheme === 'dark' ? '#A1A1A1' : '#707070';
  const tooltipBg = mounted && resolvedTheme === 'dark' ? '#171717' : '#FFFFFF';

  if (!mounted) return null;

  // Employees (no company analytics permission) get a personal, My-Work-focused
  // overview instead of company-wide executive analytics.
  if (!canViewAnalytics) return <EmployeeOverview />;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8"
      >
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Module_Dashboard</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Command Center</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded-none" />
          Sync_Active // {new Date().toLocaleTimeString()}
        </div>
      </motion.div>

      {/* AI Summary */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6 }}
      >
        <Card className="border border-border shadow-none rounded-none bg-background relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
          <CardContent className="p-6 md:p-8 flex items-start gap-6">
            <div className="p-3 bg-foreground text-background border border-foreground rounded-none shrink-0 mt-1">
              <Terminal className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-mono text-sm font-bold mb-4 uppercase tracking-widest text-foreground">Intelligence_Feed</h3>
              {overview && overview.signals.length === 0 && (
                <p className="text-base text-muted-foreground leading-relaxed font-light">
                  No active signals. No overdue or blocked work, open incidents, pending approvals, or flagged projects across your organization.
                </p>
              )}
              {overview && overview.signals.length > 0 && (
                <div className="flex flex-col divide-y divide-border border border-border">
                  {overview.signals.map((s) => (
                    <Link key={s.kind} href={s.href}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-hover transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className={`uppercase text-[10px] font-mono px-1.5 py-0.5 border ${s.severity === 'critical' ? 'border-destructive/40 text-destructive bg-destructive/10'
                            : s.severity === 'high' ? 'border-orange-500/40 text-orange-500 bg-orange-500/10'
                              : 'border-border text-muted-foreground bg-surface'}`}>
                          {s.severity}
                        </span>
                        <span className="text-sm text-foreground">{s.label}</span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">View →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* High-level metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Projects', value: pad(metrics?.activeProjects), sub: 'Live', icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'Task Completion', value: `${metrics?.completion ?? 0}%`, sub: `${pad(metrics?.doneTasks)}/${pad(metrics?.totalTasks)} Done`, icon: <BarChart className="w-5 h-5" /> },
          { label: 'Projects at Risk', value: pad(metrics?.projectsAtRisk), sub: 'Health Flag', icon: <AlertTriangle className="w-5 h-5" /> },
          { label: 'Overdue Tasks', value: pad(metrics?.overdueTasks), sub: `${pad(metrics?.blockedTasks)} Blocked`, icon: <ShieldAlert className="w-5 h-5" /> },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <Card className="shadow-none border-border rounded-none bg-background hover:border-foreground transition-colors group relative h-full">
              <div className="absolute top-0 right-0 p-2 font-mono text-[10px] text-muted-foreground group-hover:text-foreground">0{i + 1}</div>
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-muted-foreground mb-8">
                  <span className="font-mono text-[10px] uppercase tracking-widest">{stat.label}</span>
                  <div className="p-2 border border-border group-hover:bg-foreground group-hover:text-background transition-colors">{stat.icon}</div>
                </div>
                <div>
                  <div className="text-5xl font-bold mb-2 text-foreground tracking-tighter">{stat.value}</div>
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{stat.sub}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7 }}
        >
          <Card className="shadow-none border-border rounded-none bg-background h-full">
            <CardHeader className="border-b border-border pb-4 mb-4">
              <CardTitle className="text-sm font-mono uppercase tracking-widest text-foreground">Sprint_Velocity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {overview && overview.velocity.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6">
                    No completed sprints yet — velocity history will appear once a sprint is completed.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overview?.velocity ?? []} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} dy={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '0', border: `1px solid ${chartColor}`, fontSize: '12px', fontFamily: 'monospace', backgroundColor: tooltipBg, textTransform: 'uppercase' }}
                        cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Line type="step" dataKey="points" stroke={chartColor} strokeWidth={2} dot={{ r: 4, fill: tooltipBg, stroke: chartColor, strokeWidth: 2 }} activeDot={{ r: 6, fill: chartColor }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7 }}
        >
          <Card className="shadow-none border-border rounded-none bg-background h-full">
            <CardHeader className="border-b border-border pb-4 mb-4">
              <CardTitle className="text-sm font-mono uppercase tracking-widest text-foreground">Open_Tasks_By_Project</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {overview && overview.workload.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6">
                    No open tasks across active projects.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview?.workload ?? []} margin={{ top: 10, right: 10, bottom: 10, left: -20 }} barGap={0} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} dy={15} tickFormatter={(value) => String(value).toUpperCase()} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '0', border: `1px solid ${chartColor}`, fontSize: '12px', fontFamily: 'monospace', backgroundColor: tooltipBg, textTransform: 'uppercase' }}
                        cursor={{ fill: gridColor, opacity: 0.2 }}
                      />
                      <Bar dataKey="open" name="Open Tasks" fill={chartColor} radius={[0, 0, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Needs Attention Table */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8 }}
      >
        <Card className="shadow-none border-border rounded-none bg-background">
          <CardHeader className="border-b border-border pb-6">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-foreground" />
              Priority_Overrides
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {overview && overview.priorityItems.length === 0 ? (
                <div className="px-6 py-10 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Nothing requires a priority override — no blocked or overdue tasks and no open incidents.
                </div>
              ) : (
                <table className="w-full min-w-[640px] text-sm text-left border-collapse">
                  <thead className="text-[10px] text-muted-foreground bg-surface-hover uppercase tracking-widest font-mono border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-bold">Identifier</th>
                      <th className="px-6 py-4 font-bold">Class</th>
                      <th className="px-6 py-4 font-bold">Project</th>
                      <th className="px-6 py-4 font-bold">State</th>
                      <th className="px-6 py-4 font-bold">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(overview?.priorityItems ?? []).map((row, i) => (
                      <tr key={i} className="hover:bg-foreground hover:text-background transition-colors group cursor-pointer"
                        onClick={() => { window.location.href = row.href; }}>
                        <td className="px-6 py-4 font-mono font-bold text-xs">{row.identifier}</td>
                        <td className="px-6 py-4 font-mono text-[10px] uppercase tracking-wider group-hover:text-background/80 text-muted-foreground">{row.cls}</td>
                        <td className="px-6 py-4 font-mono text-xs">{row.project}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-bold font-mono text-[10px] uppercase tracking-widest border-border group-hover:border-background/30 rounded-none group-hover:text-background text-foreground">
                            {row.state}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 font-mono text-[10px] uppercase tracking-wider group-hover:text-background/80 text-muted-foreground">{row.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
