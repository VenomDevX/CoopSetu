'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiSend } from '@/lib/api/client';
import { useParams } from 'next/navigation';
import {
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Users,
  Calendar,
  Target,
  TrendingUp,
  KanbanSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePermission } from '@/lib/permissions/context';
import { AskAiButton } from '@/components/ai/ask-ai-button';

interface RawTask {
  id: string;
  title: string;
  status: string;
  story_points: number | null;
  task_type: string | null;
  primary_assignee_member_id: string | null;
}
interface Member { id: string; name: string }

const TABS = ['Board', 'Metrics', 'Planning', 'Retrospective'];

const BOARD_COLUMNS: { id: string; name: string; statuses: string[] }[] = [
  { id: 'todo', name: 'To Do', statuses: ['BACKLOG', 'READY'] },
  { id: 'in-progress', name: 'In Progress', statuses: ['IN_PROGRESS'] },
  { id: 'review', name: 'Code Review', statuses: ['CODE_REVIEW'] },
  { id: 'qa', name: 'QA Testing', statuses: ['QA_TESTING'] },
  { id: 'blocked', name: 'Blocked', statuses: ['BLOCKED'] },
  { id: 'done', name: 'Done', statuses: ['DONE', 'READY_FOR_RELEASE', 'READY_FOR_REVIEW'] },
];

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

const statusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE': return 'border-emerald-500 text-emerald-500 bg-emerald-500/10';
    case 'PLANNED': return 'border-accent text-accent bg-accent/10';
    case 'COMPLETED': return 'border-border text-muted-foreground bg-surface';
    default: return 'border-border text-muted-foreground bg-surface';
  }
};

export default function SprintDetailPage() {
  const params = useParams<{ sprintId: string }>();
  const sprintId = params?.sprintId as string;
  const { has } = usePermission();
  const [activeTab, setActiveTab] = useState('Board');
  const [updating, setUpdating] = useState(false);

  const {
    data,
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['sprints', sprintId],
    queryFn: () => apiGet<{
      sprint: { id: string; name: string; goal: string | null; status: string; start_date: string | null; end_date: string | null; capacity_hours: number | null };
      plannedPoints: number; completedPoints: number; remainingPoints: number; capacityHours: number | null;
      tasks: RawTask[];
    }>(`/api/v1/sprints/${sprintId}`),
    enabled: !!sprintId,
  });
  const error = isError ? 'Failed to load sprint.' : null;
  const load = () => refetch();

  const { data: members = [] } = useQuery({
    queryKey: ['employees', 'directory'],
    queryFn: async () => {
      const rows = await apiGet<any[]>('/api/v1/employees');
      return (Array.isArray(rows) ? rows : []).map((m: { id: string; profile: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null }) => {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
        return { id: m.id, name: p?.full_name ?? p?.email ?? 'Member' } as Member;
      });
    },
  });

  async function completeSprint() {
    setUpdating(true);
    await apiSend(`/api/v1/sprints/${sprintId}/complete`, 'POST').catch(() => { });
    setUpdating(false);
    load();
  }

  if (loading) {
    return <div className="p-8 font-mono text-xs uppercase tracking-widest animate-pulse">Loading sprint…</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <div className="text-[10px] font-mono uppercase tracking-widest text-destructive mb-3">{error ?? 'Sprint not found.'}</div>
        <Button variant="outline" size="sm" className="rounded-none text-xs font-mono uppercase tracking-widest" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  const s = data.sprint;
  const progress = data.plannedPoints ? Math.round((data.completedPoints / data.plannedPoints) * 100) : 0;
  const tasks = data.tasks ?? [];
  const blocked = tasks.filter((t) => t.status === 'BLOCKED');
  const assigneeName = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? 'Assigned') : 'Unassigned');
  const distinctAssignees = new Set(tasks.map((t) => t.primary_assignee_member_id).filter(Boolean)).size;

  // Real timeline progress from sprint dates.
  let timelineText = `${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}`;
  if (s.start_date && s.end_date) {
    const start = new Date(s.start_date); const end = new Date(s.end_date); const now = new Date();
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const elapsed = Math.min(totalDays, Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000)));
    timelineText = `Day ${elapsed} of ${totalDays}`;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <Link href="/dashboard/sprints" className="hover:text-foreground hover:underline underline-offset-4">Sprints</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{s.name}</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
              <KanbanSquare className="w-8 h-8" />
              {s.name}
            </h1>
            <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${statusBadge(s.status)}`}>
              {s.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AskAiButton intent="summarize-sprint" sprintId={sprintId} permission="task:view" label="Sprint Insights" title="Sprint Summary" />
          {has('sprint:complete') && (
            <Button data-testid="sprint-detail-complete" disabled={updating || s.status === 'COMPLETED'} onClick={completeSprint}
              className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" />
              {s.status === 'COMPLETED' ? 'Completed' : updating ? 'Completing…' : 'Complete Sprint'}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip — all real / derived */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 flex-shrink-0">
        <div className="p-4 border border-border bg-surface">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Sprint Goal</div>
          <div className="text-xs font-bold line-clamp-2">{s.goal || 'No goal set.'}</div>
        </div>
        <div className="p-4 border border-border bg-surface relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-20"><TrendingUp className="w-10 h-10" /></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Points Completed</div>
          <div className="text-2xl font-bold tracking-tighter relative z-10">{data.completedPoints} <span className="text-sm font-normal text-muted-foreground">/ {data.plannedPoints}</span></div>
          <div className="h-1 bg-background border border-border w-full overflow-hidden mt-2 relative z-10">
            <div className="h-full bg-foreground" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="p-4 border border-border bg-surface relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-20"><Calendar className="w-10 h-10" /></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Timeline</div>
          <div className="text-sm font-bold relative z-10">{timelineText}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1 relative z-10">Ends {fmtDate(s.end_date)}</div>
        </div>
        <div className="p-4 border border-border bg-surface relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-20"><Activity className="w-10 h-10" /></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Remaining Points</div>
          <div className="text-2xl font-bold tracking-tighter relative z-10">{data.remainingPoints}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1 relative z-10">{tasks.length} tasks</div>
        </div>
        <div className="p-4 border border-border bg-surface relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-20"><AlertTriangle className={`w-10 h-10 ${blocked.length ? 'text-destructive' : ''}`} /></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Blocked</div>
          <div className={`text-2xl font-bold tracking-tighter relative z-10 ${blocked.length ? 'text-destructive' : ''}`}>{blocked.length}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1 relative z-10">blocked items</div>
        </div>
        <div className="p-4 border border-border bg-surface relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-20"><Users className="w-10 h-10" /></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Capacity</div>
          <div className="text-2xl font-bold tracking-tighter relative z-10">{data.capacityHours != null ? `${data.capacityHours}h` : '—'}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1 relative z-10">{distinctAssignees} assignee{distinctAssignees === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none flex-shrink-0">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border-b-2 whitespace-nowrap transition-colors ${activeTab === tab ? 'border-foreground text-foreground font-bold' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {activeTab === 'Board' && (
          <div className="flex h-full gap-4 overflow-x-auto scrollbar-thin pb-4">
            {BOARD_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => col.statuses.includes(t.status));
              return (
                <div key={col.id} className="flex-shrink-0 w-72 flex flex-col border border-border bg-surface/30">
                  <div className="p-3 border-b border-border bg-surface-hover flex items-center justify-between">
                    <div className="font-mono text-xs uppercase tracking-widest font-bold">{col.name}</div>
                    <div className="text-[10px] font-mono px-1.5 py-0.5 bg-background border border-border">{colTasks.length}</div>
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {colTasks.map((task) => (
                      <div key={task.id} className={`p-3 border bg-background hover:border-foreground transition-colors ${task.status === 'BLOCKED' ? 'border-destructive/50 border-l-2 border-l-destructive' : 'border-border'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-mono text-[10px] uppercase px-1 py-0.5 bg-surface border border-border text-muted-foreground">{task.task_type ?? 'TASK'}</span>
                          {task.status === 'BLOCKED' && <AlertTriangle className="w-3 h-3 text-destructive" />}
                        </div>
                        <div className="text-sm font-bold mb-3 leading-tight">{task.title}</div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-surface border border-border flex items-center justify-center font-mono text-[9px] uppercase">{assigneeName(task.primary_assignee_member_id).charAt(0)}</div>
                            <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">{assigneeName(task.primary_assignee_member_id)}</span>
                          </div>
                          <div className="font-mono text-[10px] px-1.5 py-0.5 border border-border bg-surface-hover">{task.story_points ?? 0} <span className="text-muted-foreground">pts</span></div>
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="h-16 flex items-center justify-center text-[10px] font-mono text-muted-foreground uppercase border border-dashed border-border m-2">Empty</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'Metrics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real points summary (no fabricated burndown series) */}
            <div className="border border-border bg-background">
              <div className="p-4 border-b border-border bg-surface-hover">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Story Points</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2"><span className="text-muted-foreground">Completed</span><span className="font-bold">{data.completedPoints} / {data.plannedPoints} pts ({progress}%)</span></div>
                  <div className="h-2 bg-surface border border-border w-full overflow-hidden"><div className="h-full bg-foreground" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border text-center">
                  <div><div className="text-2xl font-bold">{data.plannedPoints}</div><div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Planned</div></div>
                  <div><div className="text-2xl font-bold">{data.completedPoints}</div><div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Completed</div></div>
                  <div><div className="text-2xl font-bold">{data.remainingPoints}</div><div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Remaining</div></div>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground pt-2">Time-series burndown chart not available yet.</p>
              </div>
            </div>

            {/* Real blocked work */}
            <div className="border border-border bg-background flex flex-col">
              <div className="p-4 border-b border-border bg-surface-hover">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Blocked Work ({blocked.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {blocked.length === 0 && <div className="p-4 text-xs font-mono text-muted-foreground">No blocked tasks.</div>}
                {blocked.map((t) => (
                  <div key={t.id} className="p-4 flex justify-between items-start gap-3">
                    <div className="text-sm font-bold">{t.title}</div>
                    <span className="text-[10px] font-mono uppercase text-destructive border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 flex-shrink-0">Blocked</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'Planning' || activeTab === 'Retrospective') && (
          <div className="flex flex-col items-center justify-center h-64 border border-border border-dashed bg-surface/30 gap-2">
            <Target className="w-8 h-8 text-muted-foreground" />
            <h3 className="font-mono text-sm uppercase tracking-widest font-bold">{activeTab}</h3>
            <p className="text-xs text-muted-foreground font-mono">Not available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
