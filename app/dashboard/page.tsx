'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Terminal, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Plus, Users, FolderKanban, Calendar, ArrowRight } from 'lucide-react';
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { usePermission, useCurrentMembership } from "@/lib/permissions/context";
import { useTablesRealtime } from "@/hooks/use-tables-realtime";
import Link from "next/link";
import type { DashboardPersona } from "@/lib/auth/dashboard-persona";
import type { AttentionQueueItem, ActivityFeedItem } from "@/services/dashboard.service";
import { CreateProjectModal } from "@/components/dashboard/create-project-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { InviteMemberModal } from "@/components/dashboard/invite-member-modal";
import { AskAiButton } from "@/components/ai/ask-ai-button";

interface DashboardData {
  persona: DashboardPersona;
  metrics: {
    activeProjects: number; projectsAtRisk: number; blockedTasks: number; overdueTasks: number;
    pendingApprovals: number; criticalBugs: number; openIncidents: number; openSecurityFindings: number;
    myActiveTasks: number; myBlockers: number; dueThisWeek: number; pendingReviews: number;
  };
  signals: any[];
  attentionQueue: AttentionQueueItem[];
  velocity: { name: string; points: number }[];
  workload: { name: string; open: number }[];
  upcomingDeadlines: any[];
  recentActivity: ActivityFeedItem[];
}

export default function CommandCenter() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastSync, setLastSync] = useState<string>('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  const { has } = usePermission();
  const membership = useCurrentMembership();

  const load = useCallback(() => {
    fetch('/api/v1/dashboard/overview')
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setData(j.data);
          setLastSync(new Date().toLocaleTimeString());
        }
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
  }, [load]);

  // Realtime updates (debounced invalidation internally by the hook or API logic in typical setups)
  // Revalidates data when these tables change. RLS ensures they only get events they are allowed to see,
  // and load() re-fetches explicitly scoped authorized data.
  useTablesRealtime(['tasks', 'projects', 'incidents', 'bugs', 'security_findings', 'approval_requests', 'sprints'], load);

  const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');

  const chartColor = mounted && resolvedTheme === 'dark' ? '#F5F5F5' : '#111111';
  const gridColor = mounted && resolvedTheme === 'dark' ? '#2A2A2A' : '#E2E2E2';
  const textColor = mounted && resolvedTheme === 'dark' ? '#A1A1A1' : '#707070';
  const tooltipBg = mounted && resolvedTheme === 'dark' ? '#171717' : '#FFFFFF';

  if (!mounted) return null;
  if (!data) return <div className="p-8 font-mono text-sm uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Command Center...</div>;

  const { persona, metrics, signals, attentionQueue, velocity, workload, upcomingDeadlines, recentActivity } = data;

  const today = new Date();
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toLocaleDateString();
  const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)).toLocaleDateString();

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-border pb-6"
      >
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded-none" />
            WORKSPACE: {membership.organizationName} // SYNC: ACTIVE // UPDATED: {lastSync}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground mb-1">Command Center</h1>
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            {startOfWeek} — {endOfWeek}
          </div>
        </div>
        
        {/* Actions based on Persona / Permissions */}
        <div className="flex flex-wrap items-center gap-3">
          {persona === 'ADMIN' && (
            <>
              {has('project:create') && (
                <Button variant="outline" className="rounded-none font-mono text-xs uppercase" onClick={() => setIsProjectModalOpen(true)}>
                  <FolderKanban className="w-4 h-4 mr-2" /> Create Project
                </Button>
              )}
              {has('task:create') && (
                <Button variant="outline" className="rounded-none font-mono text-xs uppercase" onClick={() => setIsTaskModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create Task
                </Button>
              )}
              {has('member:invite') && (
                <Button variant="outline" className="rounded-none font-mono text-xs uppercase" onClick={() => setIsInviteModalOpen(true)}>
                  <Users className="w-4 h-4 mr-2" /> Invite Member
                </Button>
              )}
            </>
          )}

          {persona === 'PROJECT_MANAGER' && (
            <>
              {has('task:create') && (
                <Button variant="outline" className="rounded-none font-mono text-xs uppercase" onClick={() => setIsTaskModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create Task
                </Button>
              )}
              {has('project:manage') && (
                <Button variant="outline" className="rounded-none font-mono text-xs uppercase" asChild>
                  <Link href="/dashboard/sprints/new"><Calendar className="w-4 h-4 mr-2" /> Create Sprint</Link>
                </Button>
              )}
            </>
          )}

          {persona === 'EMPLOYEE' && (
            <Button variant="outline" className="rounded-none font-mono text-xs uppercase" asChild>
              <Link href="/dashboard/my-work"><ArrowRight className="w-4 h-4 mr-2" /> View My Work</Link>
            </Button>
          )}

          {has('ai:use') && (
            <AskAiButton />
          )}
        </div>
      </motion.div>

      {/* INTELLIGENCE FEED */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <Card className="border border-border shadow-none rounded-none bg-background relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
          <CardContent className="p-6 flex flex-col md:flex-row items-start gap-6">
            <div className="p-3 bg-foreground text-background border border-foreground rounded-none shrink-0 md:mt-1 hidden md:block">
              <Terminal className="w-6 h-6" />
            </div>
            <div className="flex-1 w-full">
              <h3 className="font-mono text-sm font-bold mb-4 uppercase tracking-widest text-foreground">Intelligence_Feed</h3>
              {signals.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">
                  No active delivery signals require attention.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border border border-border">
                  {signals.map((s, idx) => (
                    <Link key={idx} href={s.href} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className={`uppercase text-[10px] font-mono px-1.5 py-0.5 border ${
                          s.severity === 'critical' ? 'border-destructive/40 text-destructive bg-destructive/10' :
                          s.severity === 'high' ? 'border-orange-500/40 text-orange-500 bg-orange-500/10' :
                          'border-border text-muted-foreground bg-surface'
                        }`}>
                          {s.severity}
                        </span>
                        <span className="text-sm text-foreground">{s.label}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground hidden sm:block">VIEW →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {(persona === 'EMPLOYEE' ? [
          { label: 'My Active Tasks', value: pad(metrics.myActiveTasks), sub: 'Assigned', icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'My Blockers', value: pad(metrics.myBlockers), sub: 'Requires Action', icon: <AlertTriangle className="w-5 h-5" /> },
          { label: 'Due This Week', value: pad(metrics.dueThisWeek), sub: 'Approaching', icon: <Clock className="w-5 h-5" /> },
          { label: 'Pending Reviews', value: pad(metrics.pendingReviews), sub: 'PRs & QA', icon: <ShieldAlert className="w-5 h-5" /> },
        ] : [
          { label: 'Active Projects', value: pad(metrics.activeProjects), sub: 'In Flight', icon: <FolderKanban className="w-5 h-5" /> },
          { label: 'Projects at Risk', value: pad(metrics.projectsAtRisk), sub: 'Requires Review', icon: <AlertTriangle className="w-5 h-5" /> },
          { label: 'Blocked / Overdue', value: pad(metrics.blockedTasks + metrics.overdueTasks), sub: `${metrics.blockedTasks} Blocked · ${metrics.overdueTasks} Overdue`, icon: <Clock className="w-5 h-5" /> },
          { label: 'Pending Approvals', value: pad(metrics.pendingApprovals), sub: 'Release Gates', icon: <ShieldAlert className="w-5 h-5" /> },
        ]).map((stat, i) => (
          <Card key={i} className="shadow-none border-border rounded-none bg-background hover:border-foreground transition-colors group relative">
            <div className="absolute top-0 right-0 p-2 font-mono text-[10px] text-muted-foreground group-hover:text-foreground">0{i + 1}</div>
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-muted-foreground mb-8">
                <span className="font-mono text-[10px] uppercase tracking-widest">{stat.label}</span>
                <div className="p-2 border border-border group-hover:bg-foreground group-hover:text-background transition-colors">{stat.icon}</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2 text-foreground tracking-tighter">{stat.value}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">{stat.sub}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* OPERATIONAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Delivery Trend */}
        <Card className="shadow-none border-border rounded-none bg-background h-full flex flex-col">
          <CardHeader className="border-b border-border pb-4 mb-4">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-foreground">Delivery_Trend</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {velocity.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
                No completed sprint data is available yet.<br/>Create and complete a sprint to view delivery trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={velocity} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
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
          </CardContent>
        </Card>

        {/* Work by Project */}
        <Card className="shadow-none border-border rounded-none bg-background h-full flex flex-col">
          <CardHeader className="border-b border-border pb-4 mb-4">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-foreground">Work_By_Project</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {workload.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
                No active work found for accessible projects.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workload} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: textColor }} />
                  <Tooltip
                    cursor={{ fill: gridColor, opacity: 0.5 }}
                    contentStyle={{ borderRadius: '0', border: `1px solid ${chartColor}`, fontSize: '12px', fontFamily: 'monospace', backgroundColor: tooltipBg, textTransform: 'uppercase' }}
                  />
                  <Bar dataKey="open" fill={chartColor} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Attention Queue */}
        <Card className="shadow-none border-border rounded-none bg-background h-full flex flex-col lg:col-span-2">
          <CardHeader className="border-b border-border pb-4 bg-surface sticky top-0 z-10">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-foreground">Attention_Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {attentionQueue.length === 0 ? (
              <div className="flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
                No items require immediate attention.
              </div>
            ) : (
              <div className="min-w-[800px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-hover text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      <th className="p-4 font-normal">Identifier</th>
                      <th className="p-4 font-normal">Item Type</th>
                      <th className="p-4 font-normal">Project</th>
                      <th className="p-4 font-normal">Severity/Priority</th>
                      <th className="p-4 font-normal">Status</th>
                      <th className="p-4 font-normal">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attentionQueue.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-hover transition-colors group">
                        <td className="p-4">
                          <Link href={item.href} className="font-mono text-xs border border-border px-1.5 py-0.5 bg-background group-hover:border-foreground transition-colors">
                            {item.identifier}
                          </Link>
                        </td>
                        <td className="p-4 text-xs font-mono uppercase text-muted-foreground">{item.entityType}</td>
                        <td className="p-4 text-sm">{item.projectName || '—'}</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border ${
                            ['CRITICAL','SEV1'].includes(item.priorityOrSeverity) ? 'border-destructive/40 text-destructive bg-destructive/10' :
                            ['HIGH','SEV2'].includes(item.priorityOrSeverity) ? 'border-orange-500/40 text-orange-500 bg-orange-500/10' :
                            'border-border text-muted-foreground bg-surface'
                          }`}>
                            {item.priorityOrSeverity}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-mono uppercase text-muted-foreground">{item.status}</td>
                        <td className="p-4 text-sm truncate max-w-[150px]">{item.ownerName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="shadow-none border-border rounded-none bg-background h-full flex flex-col lg:col-span-2">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-foreground">Upcoming_Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingDeadlines.length === 0 ? (
              <div className="flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-8">
                No upcoming authorized deadlines.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcomingDeadlines.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs border border-border px-1.5 py-0.5 bg-background">{t.task_key}</span>
                      <span className="text-sm">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      <span>{t.status}</span>
                      <span className="text-foreground">{t.due_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* RECENT ACTIVITY */}
      <Card className="shadow-none border-border rounded-none bg-background">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-xs font-mono uppercase tracking-widest text-foreground">Recent_Authorized_Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <div className="flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
              No recent authorized workspace activity.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentActivity.map((act) => (
                <div key={act.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-surface-hover transition-colors gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold">{act.actor}</span>
                    <span className="text-muted-foreground">{act.action}</span>
                    <Link href={act.href} className="font-mono text-xs border border-border px-1 py-0.5 ml-1 hover:border-foreground transition-colors">
                      {act.entityId}
                    </Link>
                    <span className="truncate max-w-[200px] md:max-w-[300px] text-muted-foreground hidden md:inline-block">— {act.targetName}</span>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {new Date(act.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isProjectModalOpen && (
        <CreateProjectModal 
          onClose={() => setIsProjectModalOpen(false)} 
          onCreated={() => { setIsProjectModalOpen(false); load(); }} 
        />
      )}

      {isTaskModalOpen && (
        <CreateTaskModal 
          onClose={() => setIsTaskModalOpen(false)} 
          onCreated={() => { setIsTaskModalOpen(false); load(); }} 
        />
      )}

      {isInviteModalOpen && (
        <InviteMemberModal 
          onClose={() => setIsInviteModalOpen(false)} 
          onInvited={() => { setIsInviteModalOpen(false); load(); }} 
        />
      )}
    </div>
  );
}
