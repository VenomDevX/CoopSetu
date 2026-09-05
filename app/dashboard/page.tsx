'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Terminal, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Plus, Users, FolderKanban, Calendar, ArrowRight, Activity, Server, GraduationCap, Award, Briefcase, ClipboardCheck } from 'lucide-react';
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useTranslations } from 'next-intl';
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
    // Training personas (INSTITUTE_ADMIN / TRAINER / TRAINEE / EMPLOYER) — see
    // services/dashboard.service.ts's getTrainingOverview().
    activeTrainees: number; activeTrainers: number; activeBatches: number; certificatesIssued: number;
    myBatches: number; myTrainees: number; pendingGrading: number; sessionsThisWeek: number;
    myCertificates: number; myApplications: number; assessmentsTaken: number; coursesInProgress: number;
    activeJobPostings: number; totalApplications: number; shortlisted: number; filledPositions: number;
  };
  signals: any[];
  attentionQueue: AttentionQueueItem[];
  velocity: { name: string; points: number }[];
  workload: { name: string; open: number }[];
  upcomingDeadlines: any[];
  recentActivity: ActivityFeedItem[];
}

export default function CommandCenter() {
  const t = useTranslations('Dashboard');
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
    queueMicrotask(() => setMounted(true));
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
  if (!data) return <div className="p-8 font-mono text-sm uppercase tracking-widest text-muted-foreground animate-pulse">{t('initializing')}</div>;

  const { persona, metrics, signals, attentionQueue, velocity, workload, upcomingDeadlines, recentActivity } = data;

  const today = new Date();
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toLocaleDateString();
  const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)).toLocaleDateString();

  // KPI cards per persona. INSTITUTE_ADMIN/TRAINER/TRAINEE/EMPLOYER get the
  // training-domain metrics from getTrainingOverview(); every other persona
  // keeps the original apexfintech-domain set.
  const kpiCards =
    persona === 'EMPLOYEE' ? [
      { label: t('myActiveTasks'), value: pad(metrics.myActiveTasks), sub: 'Assigned', icon: <CheckCircle2 className="w-5 h-5" /> },
      { label: t('myBlockers'), value: pad(metrics.myBlockers), sub: 'Requires Action', icon: <AlertTriangle className="w-5 h-5" /> },
      { label: t('dueThisWeek'), value: pad(metrics.dueThisWeek), sub: 'Approaching', icon: <Clock className="w-5 h-5" /> },
      { label: t('pendingReviews'), value: pad(metrics.pendingReviews), sub: 'PRs & QA', icon: <ShieldAlert className="w-5 h-5" /> },
    ] : persona === 'INSTITUTE_ADMIN' ? [
      { label: t('activeTrainees'), value: pad(metrics.activeTrainees), sub: 'Enrolled', icon: <GraduationCap className="w-5 h-5" /> },
      { label: t('activeTrainers'), value: pad(metrics.activeTrainers), sub: 'On Staff', icon: <Users className="w-5 h-5" /> },
      { label: t('activeBatches'), value: pad(metrics.activeBatches), sub: 'In Progress', icon: <FolderKanban className="w-5 h-5" /> },
      { label: t('certificatesIssued'), value: pad(metrics.certificatesIssued), sub: 'Active', icon: <Award className="w-5 h-5" /> },
    ] : persona === 'TRAINER' ? [
      { label: t('myBatches'), value: pad(metrics.myBatches), sub: 'Assigned', icon: <FolderKanban className="w-5 h-5" /> },
      { label: t('myTrainees'), value: pad(metrics.myTrainees), sub: 'Enrolled', icon: <GraduationCap className="w-5 h-5" /> },
      { label: t('pendingGrading'), value: pad(metrics.pendingGrading), sub: 'Ungraded', icon: <ClipboardCheck className="w-5 h-5" /> },
      { label: t('sessionsThisWeek'), value: pad(metrics.sessionsThisWeek), sub: 'Attendance', icon: <Calendar className="w-5 h-5" /> },
    ] : persona === 'TRAINEE' ? [
      { label: t('coursesInProgress'), value: pad(metrics.coursesInProgress), sub: 'Learning', icon: <FolderKanban className="w-5 h-5" /> },
      { label: t('assessmentsTaken'), value: pad(metrics.assessmentsTaken), sub: 'Submitted', icon: <ClipboardCheck className="w-5 h-5" /> },
      { label: t('myCertificates'), value: pad(metrics.myCertificates), sub: 'Active', icon: <Award className="w-5 h-5" /> },
      { label: t('myApplications'), value: pad(metrics.myApplications), sub: 'Job Board', icon: <Briefcase className="w-5 h-5" /> },
    ] : persona === 'EMPLOYER' ? [
      { label: t('activeJobPostings'), value: pad(metrics.activeJobPostings), sub: 'Open', icon: <Briefcase className="w-5 h-5" /> },
      { label: t('totalApplications'), value: pad(metrics.totalApplications), sub: 'Received', icon: <ClipboardCheck className="w-5 h-5" /> },
      { label: t('shortlisted'), value: pad(metrics.shortlisted), sub: 'In Review', icon: <CheckCircle2 className="w-5 h-5" /> },
      { label: t('filledPositions'), value: pad(metrics.filledPositions), sub: 'Closed', icon: <Award className="w-5 h-5" /> },
    ] : [
      { label: t('activeProjects'), value: pad(metrics.activeProjects), sub: 'In Flight', icon: <FolderKanban className="w-5 h-5" /> },
      { label: t('projectsAtRisk'), value: pad(metrics.projectsAtRisk), sub: 'Requires Review', icon: <AlertTriangle className="w-5 h-5" /> },
      { label: t('blockedOverdue'), value: pad(metrics.blockedTasks + metrics.overdueTasks), sub: `${metrics.blockedTasks} Blocked · ${metrics.overdueTasks} Overdue`, icon: <Clock className="w-5 h-5" /> },
      { label: t('pendingApprovals'), value: pad(metrics.pendingApprovals), sub: 'Release Gates', icon: <ShieldAlert className="w-5 h-5" /> },
    ];

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-border/50 pb-4"
      >
        <div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-2 opacity-60">
            MODULE_01 // WORKSPACE: {membership.organizationName}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tighter uppercase text-foreground mb-1">{t('commandCenter')}</h1>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">
            {startOfWeek} — {endOfWeek}
          </div>
        </div>
        
        {/* Actions based on Persona / Permissions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 border border-border/50 rounded-sm bg-surface/20 px-3 py-1.5 mr-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full bg-accent animate-ping opacity-75" />
              <span className="relative inline-flex w-2 h-2 bg-accent" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t('liveSync')} ({lastSync})</span>
          </div>
          {persona === 'ADMIN' && (
            <>
              {has('project:create') && (
                <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setIsProjectModalOpen(true)}>
                  <FolderKanban className="w-4 h-4 mr-2" /> {t('createProject')}
                </Button>
              )}
              {has('task:create') && (
                <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setIsTaskModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> {t('createTask')}
                </Button>
              )}
              {has('member:invite') && (
                <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => {
                  if (membership.isDemo) window.dispatchEvent(new CustomEvent('demo-alert'));
                  else setIsInviteModalOpen(true);
                }}>
                  <Users className="w-4 h-4 mr-2" /> {t('inviteMember')}
                </Button>
              )}
            </>
          )}

          {persona === 'PROJECT_MANAGER' && (
            <>
              {has('task:create') && (
                <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setIsTaskModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> {t('createTask')}
                </Button>
              )}
              {has('project:manage') && (
                <Button variant="outline" className="rounded font-mono text-xs uppercase" asChild>
                  <Link href="/dashboard/sprints/new"><Calendar className="w-4 h-4 mr-2" /> {t('createSprint')}</Link>
                </Button>
              )}
            </>
          )}

          {persona === 'EMPLOYEE' && (
            <Button variant="outline" className="rounded font-mono text-xs uppercase" asChild>
              <Link href="/dashboard/my-work"><ArrowRight className="w-4 h-4 mr-2" /> {t('viewMyWork')}</Link>
            </Button>
          )}

          {persona === 'INSTITUTE_ADMIN' && (
            <Button variant="outline" className="rounded font-mono text-xs uppercase" asChild>
              <Link href="/dashboard/batches"><ArrowRight className="w-4 h-4 mr-2" /> {t('viewBatches')}</Link>
            </Button>
          )}

          {persona === 'TRAINER' && (
            <Button variant="outline" className="rounded font-mono text-xs uppercase" asChild>
              <Link href="/dashboard/assessments"><ArrowRight className="w-4 h-4 mr-2" /> {t('gradeSubmissions')}</Link>
            </Button>
          )}

          {persona === 'TRAINEE' && (
            <Button variant="outline" className="rounded font-mono text-xs uppercase" asChild>
              <Link href="/dashboard/courses"><ArrowRight className="w-4 h-4 mr-2" /> {t('continueLearning')}</Link>
            </Button>
          )}

          {persona === 'EMPLOYER' && (
            <Button variant="outline" className="rounded font-mono text-xs uppercase" asChild>
              <Link href="/dashboard/applications"><ArrowRight className="w-4 h-4 mr-2" /> {t('viewApplications')}</Link>
            </Button>
          )}

          {has('ai:use') && (
            <AskAiButton />
          )}
        </div>
      </motion.div>



      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((stat, i) => (
          <Card key={i} className="shadow-none border border-border/50 rounded-lg bg-card/10 relative overflow-hidden flex flex-col justify-between min-h-[160px] hover:border-foreground/30 transition-colors">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-6">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-70">
                  {stat.label}
                </span>
                <div className="w-8 h-8 rounded border border-border/50 flex items-center justify-center opacity-60 text-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                  {stat.icon}
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold tracking-tighter mb-1 text-foreground">{stat.value}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-50 truncate">{stat.sub}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* AI SYSTEMS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[
          { label: t('aiRequestsProcessed'), value: '1.2M', sub: 'Last 30 Days', icon: <Terminal className="w-5 h-5" /> },
          { label: t('tokenConsumption'), value: '450.5M', sub: 'Input / Output', icon: <Activity className="w-5 h-5" /> },
          { label: t('avgModelLatency'), value: '245ms', sub: 'Across All Endpoints', icon: <Clock className="w-5 h-5" /> },
          { label: t('activeLlmEndpoints'), value: '3', sub: 'GPT-4 · Gemini · LLaMA', icon: <Server className="w-5 h-5" /> },
        ].map((stat, i) => (
          <Card key={`ai-stat-${i}`} className="shadow-none border border-border/50 rounded-lg bg-card/10 relative overflow-hidden flex flex-col justify-between min-h-[140px] hover:border-blue-500/30 transition-colors group">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-6">
                <span className="font-mono text-[10px] uppercase tracking-widest text-blue-400 opacity-70">
                  {stat.label}
                </span>
                <div className="w-8 h-8 rounded border border-blue-500/20 flex items-center justify-center opacity-60 text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-300 transition-colors">
                  {stat.icon}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tighter mb-1 text-foreground">{stat.value}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-50 truncate">{stat.sub}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* OPERATIONAL GRID - ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Charts Container */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Delivery Trend */}
          <Card className="shadow-none border border-border/50 rounded-lg bg-card/10 h-full flex flex-col">
            <CardHeader className="border-b border-border/10 pb-4 mb-4">
              <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-70">Delivery_Trend</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px]">
              {velocity.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
                  {t('noSprintData')}<br/>{t('createSprintPrompt')}
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
          <Card className="shadow-none border border-border/50 rounded-lg bg-card/10 h-full flex flex-col">
            <CardHeader className="border-b border-border/10 pb-4 mb-4">
              <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-70">Work_By_Project</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px]">
              {workload.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
                  {t('noActiveWork')}
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
        </div>

        {/* INTELLIGENCE FEED (Right Sidebar) */}
        <Card className="shadow-none border border-border/50 rounded-lg bg-card/10 relative overflow-hidden flex flex-col h-[400px] lg:h-auto lg:col-span-1">
          <CardContent className="p-6 flex flex-col h-full">
            <div className="font-mono text-xs font-bold uppercase tracking-widest mb-6 shrink-0">
              &gt;_ AI Feed // Intelligence
            </div>
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest opacity-50">
                {t('noActiveSignals')}
              </p>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                {signals.map((s, idx) => (
                  <Link key={idx} href={s.href} className="block p-4 border border-border/30 rounded bg-muted/5 hover:bg-muted/10 transition-colors">
                    <p className="font-mono text-[11px] text-muted-foreground leading-relaxed flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="flex items-center gap-2">
                        <span className="text-blue-500 font-bold">&gt;</span>
                        <span className={`uppercase font-bold ${
                            s.severity === 'critical' ? 'text-destructive' :
                            s.severity === 'high' ? 'text-orange-500' :
                            'text-muted-foreground'
                          }`}>
                          {s.severity}:
                        </span>
                      </span>
                      <span>{s.label}</span>
                    </p>
                  </Link>
                ))}
              </div>
            )}
            <div className="pt-4 mt-4 border-t border-border/10 flex items-center gap-2 shrink-0">
              <motion.div 
                animate={{ opacity: [1, 0, 1] }} 
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-2 h-3 bg-muted-foreground" 
              />
              <span className="font-mono text-[10px] text-muted-foreground opacity-50">{t('ready')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OPERATIONAL GRID - ROW 2 */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Attention Queue */}
        <Card className="shadow-none border border-border/50 rounded-lg bg-card/10 h-full flex flex-col w-full">
          <CardHeader className="border-b border-border/10 pb-4 sticky top-0 z-10">
            <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-70">Attention_Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {attentionQueue.length === 0 ? (
              <div className="flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
                {t('noAttentionItems')}
              </div>
            ) : (
              <div className="min-w-[800px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-hover text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      <th className="p-4 font-normal">{t('colIdentifier')}</th>
                      <th className="p-4 font-normal">{t('colItemType')}</th>
                      <th className="p-4 font-normal">{t('colProject')}</th>
                      <th className="p-4 font-normal">{t('colSeverityPriority')}</th>
                      <th className="p-4 font-normal">{t('colStatus')}</th>
                      <th className="p-4 font-normal">{t('colOwner')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attentionQueue.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-hover transition-colors group">
                        <td className="p-4">
                          <Link href={item.href} className="font-mono text-xs border border-border rounded px-1.5 py-0.5 bg-background group-hover:border-foreground transition-colors">
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
        <Card className="shadow-none border border-border/50 rounded-lg bg-card/10 h-full flex flex-col w-full">
          <CardHeader className="border-b border-border/10 pb-4 sticky top-0 z-10">
            <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-70">Upcoming_Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingDeadlines.length === 0 ? (
              <div className="flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-8">
                {t('noUpcomingDeadlines')}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcomingDeadlines.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs border border-border rounded px-1.5 py-0.5 bg-background">{t.task_key}</span>
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
      <Card className="shadow-none border border-border/50 rounded-lg bg-card/10 w-full mb-8">
        <CardHeader className="border-b border-border/10 pb-4 sticky top-0 z-10">
          <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-70">Recent_Authorized_Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <div className="flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-6 py-12">
              {t('noRecentActivity')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentActivity.map((act) => (
                <div key={act.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-surface-hover transition-colors gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold">{act.actor}</span>
                    <span className="text-muted-foreground">{act.action}</span>
                    <Link href={act.href} className="font-mono text-xs border border-border rounded px-1 py-0.5 ml-1 hover:border-foreground transition-colors">
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
