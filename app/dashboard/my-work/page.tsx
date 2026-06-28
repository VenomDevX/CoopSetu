'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  AlertOctagon,
  AlertCircle,
  FileSignature,
  TrendingUp,
  ChevronRight,
  Search,
  Filter,
  CheckSquare,
  GitPullRequest,
  ShieldAlert,
  Calendar,
  MoreVertical,
  X,
  Plus,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCurrentMembership } from '@/lib/permissions/context';
import { useTablesRealtime } from '@/hooks/use-tables-realtime';
import { AiDailyBrief } from '@/components/ai/ai-daily-brief';

const STATUS_DISPLAY: Record<string, string> = {
  BACKLOG: 'Not Started', READY: 'Not Started', IN_PROGRESS: 'In Progress', BLOCKED: 'Blocked',
  CODE_REVIEW: 'In Review', QA_TESTING: 'In Review', SECURITY_REVIEW: 'In Review',
  READY_FOR_RELEASE: 'In Review', DONE: 'Completed', CANCELLED: 'Completed',
};
const CLOSED = ['DONE', 'CANCELLED'];
const REVIEW = ['CODE_REVIEW', 'QA_TESTING', 'SECURITY_REVIEW', 'READY_FOR_RELEASE'];
const PAGE_SIZE = 8;

const TABS = [
  { label: 'All Work', match: () => true },
  { label: 'In Progress', match: (s: string) => s === 'IN_PROGRESS' },
  { label: 'Waiting for Review', match: (s: string) => REVIEW.includes(s) },
  { label: 'Blocked', match: (s: string) => s === 'BLOCKED' },
  { label: 'Completed', match: (s: string) => CLOSED.includes(s) },
];

interface Task {
  id: string; task_key: string; title: string; status: string; priority: string;
  task_type: string; due_date: string | null; story_points: number | null; project_code: string;
}
interface MyWork {
  tasks: Task[];
  kpis: { active: number; dueToday: number; overdue: number; blocked: number; points: number; donePoints: number; total: number };
  blockers: { task_key: string; title: string; project?: { code?: string } | null }[];
  upcoming: { task_key: string; title: string; due_date: string | null }[];
  recentActivity: { actor: string; activity: string; taskKey: string; at: string }[];
  sprint: null | { name: string; goal: string | null; plannedPoints: number; completedPoints: number; myOpen: number; myPoints: number };
  approvals: { id: string; type: string; requester: string; project: string; dueDate: string | null }[];
}

function fmtDue(d?: string | null) {
  if (!d) return '—';
  const due = new Date(d); const today = new Date();
  const diff = Math.round((due.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return due.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}
function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MyWorkPage() {
  const membership = useCurrentMembership();
  const [data, setData] = useState<MyWork | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    fetch('/api/v1/my-work')
      .then((r) => r.json())
      .then((j) => { if (j?.data) setData(j.data); })
      .catch(() => { });
  }, []);

  useEffect(() => { load(); }, [load]);
  useTablesRealtime(['tasks', 'task_assignees', 'task_activity', 'notifications'], load);

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const kpis = data?.kpis ?? { active: 0, dueToday: 0, overdue: 0, blocked: 0, points: 0, donePoints: 0, total: 0 };

  // Filtered list drives BOTH the table rows and the "Showing X–Y of Z" line —
  // they are computed from the same array so they can never disagree.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) =>
      TABS[tabIndex].match(t.status) &&
      (!q || t.title.toLowerCase().includes(q) || t.task_key.toLowerCase().includes(q)),
    );
  }, [tasks, tabIndex, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE);

  const priorities = tasks.filter((t) => !CLOSED.includes(t.status)).slice(0, 5);

  const completionPct = kpis.points > 0 ? Math.round((kpis.donePoints / kpis.points) * 100) : 0;
  const sprintPct = data?.sprint && data.sprint.plannedPoints > 0
    ? Math.round((data.sprint.completedPoints / data.sprint.plannedPoints) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Overview</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">My Work</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <Briefcase className="w-8 h-8" />
            My Work
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            {membership.organizationName} · Your assigned work, deadlines, and active delivery items.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/tasks">
            <Button className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" />
              Go to Task Board
            </Button>
          </Link>
        </div>
      </div>

      {/* Top KPI Strip — every value derived from the same /my-work payload. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Active Tasks', value: String(kpis.active), icon: CheckSquare, trend: 'Assigned to you' },
          { label: 'Due Today', value: String(kpis.dueToday), icon: Clock, trend: 'Due today', alert: kpis.dueToday > 0 },
          { label: 'Overdue', value: String(kpis.overdue), icon: AlertOctagon, trend: 'Needs action', error: kpis.overdue > 0 },
          { label: 'Blocked Items', value: String(kpis.blocked), icon: AlertCircle, trend: 'Blocked', error: kpis.blocked > 0 },
          { label: 'Completed Pts', value: String(kpis.donePoints), icon: FileSignature, trend: 'Done' },
          { label: 'Total Points', value: `${kpis.donePoints}/${kpis.points}`, icon: TrendingUp, trend: `${completionPct}% completion` },
        ].map((kpi, i) => (
          <div key={i} className={`p-4 border ${kpi.error ? 'border-destructive/50 bg-destructive/5' : kpi.alert ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface'} relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
              <kpi.icon className={`w-12 h-12 ${kpi.error ? 'text-destructive' : kpi.alert ? 'text-accent' : 'text-muted-foreground'}`} />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{kpi.label}</div>
            <div className="text-3xl font-bold tracking-tighter mb-1 relative z-10">{kpi.value}</div>
            <div className={`font-mono text-[10px] uppercase tracking-widest ${kpi.error ? 'text-destructive' : kpi.alert ? 'text-accent' : 'text-muted-foreground'} relative z-10`}>
              {kpi.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (Main) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Priorities */}
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-accent animate-pulse" />
                Today&apos;s Priorities
              </h3>
            </div>
            <div className="divide-y divide-border">
              {priorities.map((t) => (
                <div key={t.id} className="p-4 hover:bg-surface-hover transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer" onClick={() => setSelectedTask(t)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-surface border border-border text-muted-foreground">{t.task_key}</span>
                      <span className={`font-mono text-[10px] px-2 py-0.5 border ${t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-surface border-border text-foreground'}`}>
                        {t.priority}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-accent border border-accent/30 px-2 py-0.5 bg-accent/5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due {fmtDue(t.due_date)}
                      </span>
                    </div>
                    <div className="text-sm font-bold truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-4 font-mono tracking-wider">
                      <span>{t.project_code}</span>
                      <span>{STATUS_DISPLAY[t.status] ?? t.status}</span>
                    </div>
                  </div>
                </div>
              ))}
              {priorities.length === 0 && (
                <div className="p-6 text-center text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  No open tasks assigned to you.
                </div>
              )}
            </div>
          </div>

          {/* My Tasks Data Table */}
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">My Tasks</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    placeholder="FILTER TASKS..."
                    className="h-7 pl-7 pr-3 bg-background border border-border text-[10px] font-mono uppercase w-48 focus:outline-none focus:border-foreground"
                  />
                </div>
                <Button variant="outline" size="sm" disabled title="Not available yet" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase border-border opacity-50">
                  <Filter className="w-3 h-3 mr-2" /> Filter
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border overflow-x-auto scrollbar-none">
              {TABS.map((tab, i) => (
                <button key={i} onClick={() => { setTabIndex(i); setPage(0); }} className={`px-4 py-3 text-xs font-mono uppercase tracking-widest whitespace-nowrap border-b-2 ${i === tabIndex ? 'border-foreground text-foreground font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-hover/50">
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">ID</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Title</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Due</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Pts</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((t) => {
                    const display = STATUS_DISPLAY[t.status] ?? t.status;
                    return (
                      <tr key={t.id} className="hover:bg-surface-hover group cursor-pointer" onClick={() => setSelectedTask(t)}>
                        <td className="p-3 text-muted-foreground text-xs">{t.task_key}</td>
                        <td className="p-3 text-xs font-sans font-medium truncate max-w-[200px]">{t.title}</td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 border ${display === 'Blocked' ? 'border-destructive text-destructive' : display === 'In Progress' ? 'border-accent text-accent' : 'border-border text-muted-foreground'}`}>
                            {display}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] text-muted-foreground">{fmtDue(t.due_date)}</td>
                        <td className="p-3 text-[10px] text-muted-foreground">{t.story_points ?? '—'}</td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-none opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-xs font-mono text-muted-foreground uppercase tracking-widest">
                        No tasks in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-border flex justify-between items-center text-[10px] font-mono text-muted-foreground bg-surface-hover">
              <span>Showing {rangeStart}-{rangeEnd} of {filtered.length} tasks</span>
              <div className="flex gap-2 items-center">
                <button className="hover:text-foreground disabled:opacity-40" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
                <span>{safePage + 1} / {pageCount}</span>
                <button className="hover:text-foreground disabled:opacity-40" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</button>
              </div>
            </div>
          </div>

          {/* Grid for Sprint & Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* My Sprint Work */}
            <div className="border border-border bg-background p-5">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-4">
                {data?.sprint ? data.sprint.name : 'My Sprint Work'}
              </h3>
              {data?.sprint ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-widest">
                      <span>Sprint Points Completed</span>
                      <span className="text-foreground">{data.sprint.completedPoints} / {data.sprint.plannedPoints}</span>
                    </div>
                    <div className="h-2 w-full bg-surface border border-border overflow-hidden">
                      <div className="h-full bg-foreground" style={{ width: `${sprintPct}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-3 border border-border bg-surface-hover">
                      <div className="text-2xl font-bold">{data.sprint.myOpen}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">My Open Items</div>
                    </div>
                    <div className="p-3 border border-border bg-surface-hover">
                      <div className="text-2xl font-bold">{data.sprint.myPoints}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">My Points</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest py-6">
                  No active sprint with work assigned to you.
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="border border-border bg-background flex flex-col">
              <div className="p-4 border-b border-border bg-surface-hover">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Recent Activity</h3>
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {(data?.recentActivity ?? []).map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="w-6 h-6 bg-surface border border-border rounded-none flex items-center justify-center text-[10px] font-mono text-muted-foreground flex-shrink-0 mt-0.5">
                      {item.actor.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-xs">{item.actor}</span> <span className="text-muted-foreground text-xs">{item.activity}</span> <span className="font-mono text-[10px] px-1 bg-surface border border-border text-foreground">{item.taskKey}</span>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">{relTime(item.at)}</div>
                    </div>
                  </div>
                ))}
                {(data?.recentActivity ?? []).length === 0 && (
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest py-2">
                    No recent activity on your tasks.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Right Column (Side Panel) */}
        <div className="space-y-8">

          {/* AI Daily Brief — real streamed summary from /api/v1/ai/stream
              (daily-brief intent) with source links; renders only for members
              with the ai:use permission. */}
          <AiDailyBrief />

          {/* Blockers */}
          <div className="border border-destructive/30 bg-background">
            <div className="p-4 border-b border-destructive/30 bg-destructive/5 flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-destructive flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> My Blockers ({data?.blockers.length ?? 0})
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {(data?.blockers ?? []).map((b, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-sm font-bold">{b.task_key}: {b.title}</div>
                  <div className="text-xs text-muted-foreground font-mono">{b.project?.code ?? ''}</div>
                </div>
              ))}
              {(data?.blockers ?? []).length === 0 && (
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  No blocked tasks assigned to you.
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Next 7 Days</h3>
            </div>
            <div className="p-4 space-y-4">
              {(data?.upcoming ?? []).map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-16 font-mono text-[10px] uppercase text-muted-foreground text-right pt-1">{fmtDue(item.due_date)}</div>
                  <div className="flex-1 border-l border-border pl-4 relative">
                    <div className="absolute -left-1 top-1.5 w-2 h-2 bg-background border border-foreground" />
                    <div className="text-xs font-bold">{item.title}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{item.task_key}</div>
                  </div>
                </div>
              ))}
              {(data?.upcoming ?? []).length === 0 && (
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  No deadlines in the next 7 days.
                </div>
              )}
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Pending Approvals</h3>
              <span className="font-mono text-[10px] px-2 py-0.5 bg-foreground text-background">{data?.approvals.length ?? 0} Pending</span>
            </div>
            <div className="divide-y divide-border">
              {(data?.approvals ?? []).map((item) => (
                <div key={item.id} className="p-4 hover:bg-surface-hover transition-colors">
                  <div className="text-xs font-bold mb-1">{item.type}</div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">{item.project} • {item.requester}</div>
                    <Link href="/dashboard/qa-security" className="h-6 px-2 text-[10px] font-mono uppercase hover:bg-foreground hover:text-background rounded-none flex items-center border border-border">
                      Review
                    </Link>
                  </div>
                </div>
              ))}
              {(data?.approvals ?? []).length === 0 && (
                <div className="p-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  No pending approvals.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Task Detail Drawer — real fields from the selected task only. */}
      <AnimatePresence>
        {selectedTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setSelectedTask(null)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full md:w-[600px] h-full bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface-hover flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs bg-surface border border-border px-2 py-1">{selectedTask.task_key}</span>
                  <span className="font-mono text-[10px] uppercase text-accent border border-accent/30 px-2 py-1 bg-accent/5">{STATUS_DISPLAY[selectedTask.status] ?? selectedTask.status}</span>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-surface border border-transparent hover:border-border transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold mb-4 tracking-tight">{selectedTask.title}</h2>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1">Project</div>
                      <div>{selectedTask.project_code}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1">Due Date</div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDue(selectedTask.due_date)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1">Priority</div>
                      <div>{selectedTask.priority}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1">Type</div>
                      <div>{selectedTask.task_type}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1">Story Points</div>
                      <div>{selectedTask.story_points ?? '—'}</div>
                    </div>
                  </div>
                </div>

                <Link href="/dashboard/tasks" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest border border-border px-3 py-2 hover:bg-foreground hover:text-background transition-colors">
                  <GitPullRequest className="w-3 h-3" /> Open in Task Board
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
