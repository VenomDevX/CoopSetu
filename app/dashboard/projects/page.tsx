'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { CreateProjectModal } from '@/components/dashboard/create-project-modal';
import { ExportReportModal } from '@/components/dashboard/export-report-modal';
import { ImportProjectsModal } from '@/components/dashboard/import-projects-modal';
import { usePermission } from '@/lib/permissions/context';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';
import { DataViewport } from '@/components/layout/data-viewport';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  Download,
  LayoutGrid,
  List,
  Layers,
  AlertTriangle,
  MoreVertical,
  Upload,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton, TableRowsSkeleton } from '@/components/ui/skeleton';
import { AskAiButton } from '@/components/ai/ask-ai-button';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
  code: string;
  department: string;
  owner: string;
  manager: string;
  team: string;
  health: 'On Track' | 'At Risk' | 'Off Track' | 'Completed';
  priority: 'P1' | 'P2' | 'P3';
  progress: number;
  startDate: string;
  targetDate: string;
  nextMilestone: string;
  nextRelease: string;
  openRisks: number;
};

// Maps a DB project row to the display shape used by this view.
function mapProject(r: any): Project {
  const healthMap: Record<string, Project['health']> = {
    ON_TRACK: 'On Track', AT_RISK: 'At Risk', OFF_TRACK: 'Off Track',
  };
  const prioMap: Record<string, Project['priority']> = {
    CRITICAL: 'P1', HIGH: 'P1', MEDIUM: 'P2', LOW: 'P3',
  };
  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    department: r.security_classification ?? '—',
    owner: r.owner?.profile?.full_name ?? '—',
    manager: r.project_manager?.profile?.full_name ?? '—',
    team: '—',
    health: r.status === 'COMPLETED' ? 'Completed' : (healthMap[r.health] ?? 'On Track'),
    priority: prioMap[r.priority] ?? 'P2',
    progress: 0,
    startDate: fmt(r.start_date),
    targetDate: fmt(r.target_end_date),
    nextMilestone: r.milestones?.[0]?.count != null ? `${r.milestones[0].count} milestone(s)` : '—',
    nextRelease: '—',
    openRisks: r.project_risks?.[0]?.count ?? 0,
  };
}

const getHealthColor = (health: string) => {
  switch (health) {
    case 'On Track': return 'text-emerald-500 bg-emerald-500/10';
    case 'At Risk': return 'text-orange-500 bg-orange-500/10';
    case 'Off Track': return 'text-destructive bg-destructive/10';
    case 'Completed': return 'text-muted-foreground bg-surface';
    default: return 'text-foreground bg-surface';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'P1': return 'text-destructive';
    case 'P2': return 'text-orange-500';
    case 'P3': return 'text-muted-foreground';
    default: return 'text-foreground';
  }
};

export default function ProjectsPage() {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const {
    data: projects = [],
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const rows = await apiGet<unknown[]>('/api/v1/projects');
      return (Array.isArray(rows) ? rows : []).map(mapProject);
    },
  });
  const error = isError ? 'Failed to load projects.' : null;
  const load = () => refetch();
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<'ALL' | Project['health']>('ALL');
  const { has } = usePermission();
  const canCreate = has('project:create');
  const canImport = has('project:import');
  const canExport = has('report:export');

  // Reusable refresh (used after create). Kept out of the effect so the
  // setState calls aren't flagged as synchronous-in-effect.

  // Client-side search (name/code) + health filter over the loaded rows.
  const q = query.trim().toLowerCase();
  const filtered = projects.filter((p) => {
    const matchesQuery = q === '' || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchesHealth = healthFilter === 'ALL' || p.health === healthFilter;
    return matchesQuery && matchesHealth;
  });

  // Footer stats computed from the filtered view.
  const onTrack = filtered.filter((p) => p.health === 'On Track').length;
  const atRisk = filtered.filter((p) => p.health === 'At Risk').length;
  const offTrack = filtered.filter((p) => p.health === 'Off Track').length;

  return (
    <WorkspaceDataLayout className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Delivery</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Projects</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <Layers className="w-8 h-8" />
            Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Manage delivery across products, engineering teams, programs, and business units.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canImport && (
            <Button data-testid="project-import-button" onClick={() => setIsImportModalOpen(true)} variant="outline" className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest gap-2">
              <Upload className="w-4 h-4" />
              Import
            </Button>
          )}
          {canExport && (
            <Button data-testid="project-export-report-button" onClick={() => setIsExportModalOpen(true)} variant="outline" className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          )}
          {canCreate && (
            <Button data-testid="create-project-button" onClick={() => setIsCreateModalOpen(true)} className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          )}
          <AskAiButton intent="summarize-projects" title="Projects Digest" />
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
              placeholder="SEARCH PROJECTS..."
              className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors"
            />
          </div>
          <div className="relative flex items-center">
            <Filter className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as 'ALL' | Project['health'])}
              className="h-8 pl-7 pr-3 rounded text-[10px] font-mono uppercase border border-border rounded bg-background focus:outline-none focus:border-foreground transition-colors cursor-pointer"
            >
              <option value="ALL">All Health</option>
              <option value="On Track">On Track</option>
              <option value="At Risk">At Risk</option>
              <option value="Off Track">Off Track</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-background border border-border rounded">
          <button
            onClick={() => setView('table')}
            className={`p-1.5 transition-colors ${view === 'table' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-1.5 transition-colors ${view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 border border-border rounded bg-background flex flex-col">
        {view === 'table' ? (
          <DataViewport className="border-0">
            <table className="w-full min-w-[800px] text-left text-sm font-mono border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-surface-hover z-10 shadow-[0_1px_0_0_var(--border)]">
                <tr>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Project</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Health</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal hidden sm:table-cell">Progress</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal hidden md:table-cell">Team</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal hidden sm:table-cell">Owner/Manager</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal hidden md:table-cell">Target Date</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal hidden lg:table-cell">Next Milestone</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Risks</th>
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
                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                      No projects found
                    </td>
                  </tr>
                )}
                {!loading && !error && filtered.map((project) => (
                  <tr key={project.id} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <Link href={`/dashboard/projects/${project.id}`} className="block">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold ${getPriorityColor(project.priority)}`}>{project.priority}</span>
                          <span className="font-sans font-bold text-sm truncate max-w-[200px]">{project.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-surface rounded-[3px]">{project.code}</span>
                          <span>{project.department}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-[3px] ${getHealthColor(project.health)}`}>
                        {project.health}
                      </span>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2 w-32">
                        <div className="flex-1 h-1.5 bg-surface border border-border rounded overflow-hidden">
                          <div className="h-full bg-foreground" style={{ width: `${project.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-6 text-right">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="text-xs truncate max-w-[120px]">{project.team}</div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <div className="text-xs">{project.owner}</div>
                      <div className="text-[10px] text-muted-foreground">{project.manager}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="text-xs">{project.targetDate}</div>
                      <div className="text-[10px] text-muted-foreground">Started: {project.startDate}</div>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <div className="text-xs truncate max-w-[150px]">{project.nextMilestone}</div>
                      <div className="text-[10px] text-muted-foreground">Release: {project.nextRelease}</div>
                    </td>
                    <td className="p-3">
                      {project.openRisks > 0 ? (
                        <span className="flex items-center gap-1 text-[10px] text-destructive">
                          <AlertTriangle className="w-3 h-3" /> {project.openRisks} Open
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataViewport>
        ) : (
          <DataViewport className="border-0 p-4">
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            )}
            {!loading && error && (
              <div className="p-8 text-center">
                <div className="text-[10px] font-mono uppercase tracking-widest text-destructive mb-3">{error}</div>
                <Button variant="outline" size="sm" className="rounded text-xs font-mono uppercase tracking-widest" onClick={load}>
                  Retry
                </Button>
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="p-8 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                No projects found
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {!loading && !error && filtered.map((project) => (
                <Link href={`/dashboard/projects/${project.id}`} key={project.id} className="border border-border rounded bg-background p-4 hover:border-foreground transition-colors group flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-surface rounded-[3px]">{project.code}</span>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded-[3px] ${getHealthColor(project.health)}`}>{project.health}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <h3 className="font-bold text-lg mb-1 group-hover:underline decoration-border underline-offset-4">{project.name}</h3>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Layers className="w-3 h-3" /> {project.department}
                  </div>

                  <div className="space-y-3 mb-4 flex-1">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="h-1 bg-surface border border-border rounded w-full overflow-hidden">
                        <div className="h-full bg-foreground" style={{ width: `${project.progress}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">Target</div>
                        <div>{project.targetDate}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">Next Release</div>
                        <div className="truncate">{project.nextRelease}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 border border-border rounded bg-surface flex items-center justify-center font-mono text-[9px] uppercase z-20" title={project.owner}>{project.owner.charAt(0)}</div>
                      <div className="w-6 h-6 border border-border rounded bg-surface-hover flex items-center justify-center font-mono text-[9px] uppercase z-10" title={project.manager}>{project.manager.charAt(0)}</div>
                    </div>
                    {project.openRisks > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-destructive bg-destructive/10 px-1.5 py-0.5 border border-destructive/30">
                        <AlertTriangle className="w-3 h-3" /> {project.openRisks} Risks
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </DataViewport>
        )}

        <div className="p-3 border-t border-border bg-surface-hover flex justify-between items-center text-[10px] font-mono text-muted-foreground flex-shrink-0">
          <span>Showing {filtered.length} of {projects.length} project{projects.length === 1 ? '' : 's'}</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/20 border border-emerald-500 block" /> {onTrack} On Track</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500/20 border border-orange-500 block" /> {atRisk} At Risk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-destructive/20 border border-destructive block" /> {offTrack} Off Track</span>
          </div>
        </div>
      </div>

      {/* Create Project Modal — real, wired to POST /api/v1/projects */}
      {isCreateModalOpen && (
        <CreateProjectModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={load}
        />
      )}
      {isImportModalOpen && (
        <ImportProjectsModal
          onClose={() => setIsImportModalOpen(false)}
          onImported={load}
        />
      )}
      {isExportModalOpen && (
        <ExportReportModal
          title="Export Project Report"
          endpoint="/api/v1/projects/export"
          filters={{ q: query, health: healthFilter }}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

    </WorkspaceDataLayout>
  );
}
