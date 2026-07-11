'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiSend } from '@/lib/api/client';
import { CreateSprintModal } from '@/components/dashboard/create-sprint-modal';
import { ExportReportModal } from '@/components/dashboard/export-report-modal';
import { usePermission } from '@/lib/permissions/context';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';
import { DataViewport } from '@/components/layout/data-viewport';
import {
  ChevronRight,
  Search,
  Plus,
  Download,
  KanbanSquare,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AskAiButton } from '@/components/ai/ask-ai-button';
import { TableRowsSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

type Sprint = {
  id: string;
  name: string;
  team: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Planning' | 'Completed';
  plannedPoints: number;
  completedPoints: number;
  progress: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  velocity: number;
};

const STATUS_LABEL: Record<string, Sprint['status']> = {
  ACTIVE: 'Active', PLANNED: 'Planning', COMPLETED: 'Completed', CANCELLED: 'Completed',
};
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';


function mapSprint(r: any): Sprint {
  const planned = Number(r.planned_story_points) || 0;
  const completed = Number(r.completed_story_points) || 0;
  return {
    id: r.id,
    name: r.name,
    team: r.team?.name ?? '—',
    goal: r.goal ?? '',
    startDate: fmtDate(r.start_date),
    endDate: fmtDate(r.end_date),
    status: STATUS_LABEL[r.status] ?? 'Planning',
    plannedPoints: planned,
    completedPoints: completed,
    progress: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    riskLevel: planned > 0 && completed / planned < 0.4 ? 'High' : completed / planned < 0.7 ? 'Medium' : 'Low',
    velocity: completed,
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'text-emerald-500 bg-emerald-500/10';
    case 'Planning': return 'text-accent bg-accent/10';
    case 'Completed': return 'text-muted-foreground bg-surface';
    default: return 'text-foreground bg-surface';
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'High': return 'text-destructive';
    case 'Medium': return 'text-orange-500';
    case 'Low': return 'text-emerald-500';
    default: return 'text-foreground';
  }
};

export default function SprintsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Sprint['status']>('ALL');
  const { has } = usePermission();
  const canCreate = has('sprint:create');
  const canExport = has('report:export') || has('sprint:view');

  const {
    data: mockSprints = [],
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['sprints'],
    queryFn: async () => {
      const rows = await apiGet<unknown[]>('/api/v1/sprints');
      return (Array.isArray(rows) ? rows : []).map(mapSprint);
    },
  });
  const error = isError ? 'Failed to load sprints.' : null;
  const load = () => refetch();

  // Client-side search (name/goal) + status filter over the loaded rows.
  const q = query.trim().toLowerCase();
  const filteredSprints = mockSprints.filter((s) => {
    const matchesQuery = q === '' || s.name.toLowerCase().includes(q) || s.goal.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const activeCount = filteredSprints.filter((s) => s.status === 'Active').length;
  const planningCount = filteredSprints.filter((s) => s.status === 'Planning').length;
  const completedCount = filteredSprints.filter((s) => s.status === 'Completed').length;
  const canStart = has('sprint:start');
  const canComplete = has('sprint:complete');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: 'start' | 'complete') {
    setBusyId(id);
    await apiSend(`/api/v1/sprints/${id}/${action}`, 'POST').catch(() => { });
    setBusyId(null);
    load();
  }

  return (
    <WorkspaceDataLayout className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Delivery</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Sprints</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <KanbanSquare className="w-8 h-8" />
            Sprints
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Plan, execute, track, and improve delivery cycles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canExport && (
            <Button data-testid="sprint-export-report-button" onClick={() => setIsExportOpen(true)} variant="outline" className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest gap-2">
              <Download className="w-4 h-4" />
              Export Sprint Report
            </Button>
          )}
          {canCreate && (
            <Button data-testid="create-sprint-button" onClick={() => setIsCreateOpen(true)} className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" />
              Create Sprint
            </Button>
          )}
          <AskAiButton intent="summarize-sprints" title="Sprints Digest" />
        </div>
      </div>

      {/* Top Controls */}
      <div className="p-3 border border-border rounded bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH SPRINTS..."
              className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors"
            />
          </div>
          <div className="relative flex items-center">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="h-8 pl-3 pr-3 rounded text-[10px] font-mono uppercase border border-border bg-background focus:outline-none focus:border-foreground transition-colors cursor-pointer w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Planning">Planning</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 border border-border rounded bg-background flex flex-col">
        <DataViewport className="border-0">
          <table className="w-full min-w-[800px] text-left text-sm font-mono border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-surface-hover z-10 shadow-[0_1px_0_0_var(--border)]">
              <tr>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Sprint Name</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Team</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Timeline</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Progress</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Points</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Velocity</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Risk</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <TableRowsSkeleton rows={6} cols={9} />}
              {!loading && error && (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-destructive mb-3">{error}</div>
                    <Button variant="outline" size="sm" className="rounded text-xs font-mono uppercase tracking-widest" onClick={load}>
                      Retry
                    </Button>
                  </td>
                </tr>
              )}
              {!loading && !error && filteredSprints.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                    No sprints found
                  </td>
                </tr>
              )}
              {!loading && !error && filteredSprints.map((sprint) => (
                <tr key={sprint.id} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                  <td className="p-3">
                    <Link href={`/dashboard/sprints/${sprint.id}`} className="block">
                      <div className="font-sans font-bold text-sm truncate max-w-[250px] mb-1 group-hover:underline decoration-border underline-offset-4">{sprint.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[250px]">{sprint.goal}</div>
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-[3px] ${getStatusColor(sprint.status)}`}>
                      {sprint.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-xs truncate max-w-[120px]">{sprint.team}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-xs">{sprint.startDate} -</div>
                    <div className="text-[10px] text-muted-foreground">{sprint.endDate}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 w-32">
                      <div className="flex-1 h-1.5 bg-surface border border-border rounded overflow-hidden">
                        <div className="h-full bg-foreground" style={{ width: `${sprint.progress}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-6 text-right">{sprint.progress}%</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-xs">{sprint.completedPoints} / {sprint.plannedPoints}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Pts</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs">{sprint.velocity}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    {sprint.status === 'Active' ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className={`w-2 h-2 ${getRiskColor(sprint.riskLevel).replace('text-', 'bg-')} block rounded`} />
                        <span className={getRiskColor(sprint.riskLevel)}>{sprint.riskLevel}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {sprint.status === 'Planning' && canStart && (
                        <button data-testid="sprint-start-button" disabled={busyId === sprint.id} onClick={() => act(sprint.id, 'start')}
                          className="h-6 px-2 border border-border rounded text-[10px] font-mono uppercase tracking-widest hover:bg-foreground hover:text-background disabled:opacity-50">
                          {busyId === sprint.id ? '…' : 'Start'}
                        </button>
                      )}
                      {sprint.status === 'Active' && canComplete && (
                        <button data-testid="sprint-complete-button" disabled={busyId === sprint.id} onClick={() => act(sprint.id, 'complete')}
                          className="h-6 px-2 border border-border rounded text-[10px] font-mono uppercase tracking-widest hover:bg-foreground hover:text-background disabled:opacity-50">
                          {busyId === sprint.id ? '…' : 'Complete'}
                        </button>
                      )}
                      <Link href={`/dashboard/sprints/${sprint.id}`} className="h-6 w-6 p-0 rounded opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center">
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataViewport>

        <div className="p-3 border-t border-border bg-surface-hover flex justify-between items-center text-[10px] font-mono text-muted-foreground flex-shrink-0">
          <span>Showing {filteredSprints.length} of {mockSprints.length} sprint{mockSprints.length === 1 ? '' : 's'}</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/20 border border-emerald-500 block" /> {activeCount} Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-accent/20 border border-accent block" /> {planningCount} Planning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-surface border border-border rounded block" /> {completedCount} Completed</span>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <CreateSprintModal onClose={() => setIsCreateOpen(false)} onCreated={load} />
      )}
      {isExportOpen && (
        <ExportReportModal
          title="Export Sprint Report"
          endpoint="/api/v1/sprints/export"
          filters={{ q: query, status: statusFilter }}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </WorkspaceDataLayout>
  );
}
