'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { useParams } from 'next/navigation';
import {
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Flag,
  Users,
  Layers,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';
import { AskAiButton } from '@/components/ai/ask-ai-button';
import { usePermission } from '@/lib/permissions/context';

interface Member { id: string; name: string; job_title: string | null }
interface Milestone { id: string; title: string; status: string; due_date: string | null }
interface Risk { id: string; title: string; status: string; risk_level: string | null; owner_member_id: string | null }
interface Sprint { id: string; name: string; status: string; start_date: string | null; end_date: string | null; planned_story_points: number | null; completed_story_points: number | null }
interface Release { id: string; name: string; version: string | null; status: string; planned_release_at: string | null }
interface Activity { id: string; activity_type: string; entity_type: string | null; actor_member_id: string | null; created_at: string }
interface ProjectDetail {
  id: string;
  name: string;
  code: string;
  status: string;
  health: string | null;
  priority: string;
  business_objective: string | null;
  scope: string | null;
  description: string | null;
  start_date: string | null;
  target_end_date: string | null;
  budget_amount: number | null;
  effort_estimate_hours: number | null;
  owner_member_id: string | null;
  project_manager_member_id: string | null;
  security_classification: string | null;
  milestones?: Milestone[];
  project_risks?: Risk[];
  project_members?: { organization_member_id: string }[];
  project_teams?: { team?: { id: string; name: string } | null }[];
}

const TABS = ['Overview', 'Board', 'Backlog', 'Sprints', 'Team', 'Releases', 'Risks', 'Documents', 'Activity', 'Settings'];

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

const healthColor = (h: string | null) => {
  switch (h) {
    case 'ON_TRACK': return 'border-emerald-500 text-emerald-500 bg-emerald-500/10';
    case 'AT_RISK': return 'border-orange-500 text-orange-500 bg-orange-500/10';
    case 'OFF_TRACK': return 'border-destructive text-destructive bg-destructive/10';
    default: return 'border-border text-muted-foreground bg-surface';
  }
};
const statusColor = (s: string) => {
  switch (s) {
    case 'ACTIVE': case 'DEPLOYED': case 'APPROVED_FOR_DEPLOYMENT': case 'MITIGATING':
      return 'border-emerald-500 text-emerald-500 bg-emerald-500/10';
    case 'COMPLETED': case 'CANCELLED': case 'CLOSED': case 'ROLLED_BACK':
      return 'border-border text-muted-foreground bg-surface';
    case 'BLOCKED': case 'OPEN':
      return 'border-destructive text-destructive bg-destructive/10';
    default:
      return 'border-orange-500 text-orange-500 bg-orange-500/10';
  }
};

const healthLabel = (h: string | null) =>
  ({ ON_TRACK: 'On Track', AT_RISK: 'At Risk', OFF_TRACK: 'Off Track' } as Record<string, string>)[h ?? ''] ?? (h ?? '—');

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId as string;
  const { has } = usePermission();
  const [activeTab, setActiveTab] = useState('Overview');
  const [creating, setCreating] = useState(false);

  const {
    data: project,
    isPending: projectLoading,
    isError: projectError,
    refetch: loadProject,
  } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => apiGet<ProjectDetail>(`/api/v1/projects/${projectId}`),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['employees', 'directory'],
    queryFn: async () => {
      const rows = await apiGet<any[]>('/api/v1/employees');
      return (Array.isArray(rows) ? rows : []).map((m: { id: string; profile: { full_name?: string; email?: string; job_title?: string } | { full_name?: string; email?: string; job_title?: string }[] | null }) => {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
        return { id: m.id, name: p?.full_name ?? p?.email ?? 'Member', job_title: p?.job_title ?? null } as Member;
      });
    },
  });

  const { data: progress = null } = useQuery({
    queryKey: ['projects', projectId, 'progress'],
    queryFn: async () => {
      const tasks = await apiGet<{ status: string }[]>(`/api/v1/tasks?projectId=${projectId}`);
      const list = Array.isArray(tasks) ? tasks : [];
      if (list.length === 0) return 0;
      const done = list.filter((t) => t.status === 'DONE' || t.status === 'READY_FOR_RELEASE').length;
      return Math.round((done / list.length) * 100);
    },
    enabled: !!projectId,
  });

  // Lazily load tab data the first time a data-backed tab is opened.
  const { data: sprints = null } = useQuery({
    queryKey: ['sprints', 'byProject', projectId],
    queryFn: async () => {
      const rows = await apiGet<Sprint[]>(`/api/v1/sprints?projectId=${projectId}`);
      return Array.isArray(rows) ? rows : [];
    },
    enabled: activeTab === 'Sprints' && !!projectId,
  });
  const { data: releases = null } = useQuery({
    queryKey: ['releases', 'byProject', projectId],
    queryFn: async () => {
      const rows = await apiGet<Release[]>(`/api/v1/releases?projectId=${projectId}`);
      return Array.isArray(rows) ? rows : [];
    },
    enabled: activeTab === 'Releases' && !!projectId,
  });
  const { data: activity = null } = useQuery({
    queryKey: ['projects', projectId, 'activity'],
    queryFn: async () => {
      const rows = await apiGet<Activity[]>(`/api/v1/projects/${projectId}/activity`);
      return Array.isArray(rows) ? rows : [];
    },
    enabled: activeTab === 'Activity' && !!projectId,
  });

  const memberName = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? 'Assigned') : 'Unassigned');
  const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const milestones = project?.milestones ?? [];
  const risks = project?.project_risks ?? [];
  const openRisks = risks.filter((r) => r.status === 'OPEN' || r.status === 'MITIGATING');
  const teamNames = (project?.project_teams ?? []).map((t) => t.team?.name).filter(Boolean) as string[];
  const projectMemberIds = (project?.project_members ?? []).map((m) => m.organization_member_id);

  if (projectLoading) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center text-xs font-mono text-muted-foreground">
        Loading project…
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-destructive">Failed to load project.</div>
        <Button variant="outline" size="sm" className="rounded-none text-xs font-mono uppercase tracking-widest" onClick={() => loadProject()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <Link href="/dashboard/projects" className="hover:text-foreground hover:underline underline-offset-4">Projects</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{project.code}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
              <Layers className="w-8 h-8" />
              {project.name}
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-surface border border-border">
              {project.priority}
            </span>
            <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${healthColor(project.health)}`}>
              {project.status === 'COMPLETED' ? 'Completed' : healthLabel(project.health)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AskAiButton intent="summarize-project" projectId={projectId} permission="task:view" label="Project AI" title="Project Summary" />
          {has('task:create') && (
            <Button data-testid="project-create-task" onClick={() => setCreating(true)} className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border-b-2 whitespace-nowrap transition-colors ${activeTab === tab
                ? 'border-foreground text-foreground font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'Overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Progress & Details (real) */}
              <div className="border border-border bg-background">
                <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Progress & Details</h3>
                  <span className="font-mono text-xs">{progress ?? 0}% Complete</span>
                </div>
                <div className="p-6">
                  <div className="h-2 bg-surface border border-border w-full overflow-hidden mb-8">
                    <div className="h-full bg-foreground" style={{ width: `${progress ?? 0}%` }} />
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Business Objective</h4>
                      <p className="text-sm leading-relaxed">{project.business_objective || project.description || '—'}</p>
                    </div>
                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Scope</h4>
                      <p className="text-sm leading-relaxed text-muted-foreground">{project.scope || '—'}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-border">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Start Date</div>
                        <div className="text-sm font-bold">{fmtDate(project.start_date)}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Target Date</div>
                        <div className="text-sm font-bold">{fmtDate(project.target_end_date)}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Budget</div>
                        <div className="text-sm font-bold">{project.budget_amount != null ? `$${Number(project.budget_amount).toLocaleString()}` : '—'}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Effort (est.)</div>
                        <div className="text-sm font-bold">{project.effort_estimate_hours != null ? `${project.effort_estimate_hours} hrs` : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestones (real) */}
              <div className="border border-border bg-background">
                <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                    <Flag className="w-3 h-3" /> Milestones ({milestones.length})
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {milestones.length === 0 && <div className="p-4 text-xs font-mono text-muted-foreground">No milestones.</div>}
                  {milestones.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {m.status === 'COMPLETED' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {m.status === 'MISSED' && <AlertTriangle className="w-4 h-4 text-destructive" />}
                        {(m.status === 'PLANNED' || m.status === 'IN_PROGRESS') && <div className="w-4 h-4 border border-border rounded-full" />}
                        <span className={`text-sm ${m.status === 'COMPLETED' ? 'text-muted-foreground line-through' : m.status === 'MISSED' ? 'font-bold text-destructive' : 'font-bold'}`}>
                          {m.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">{fmtDate(m.due_date)}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-6">

              {/* Team & Ownership (real) */}
              <div className="border border-border bg-background">
                <div className="p-4 border-b border-border bg-surface-hover">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                    <Users className="w-3 h-3" /> Team & Ownership
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Project Owner</div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center font-mono text-xs font-bold">{initials(memberName(project.owner_member_id))}</div>
                      <span className="text-sm font-bold">{memberName(project.owner_member_id)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Project Manager</div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center font-mono text-xs font-bold">{initials(memberName(project.project_manager_member_id))}</div>
                      <span className="text-sm font-bold">{memberName(project.project_manager_member_id)}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                      {teamNames.length > 0 ? `Teams: ${teamNames.join(', ')}` : `Direct members: ${projectMemberIds.length}`}
                    </div>
                    <div className="flex -space-x-2">
                      {projectMemberIds.slice(0, 5).map((id) => (
                        <div key={id} className="w-8 h-8 bg-surface-hover border border-border flex items-center justify-center font-mono text-[10px] font-bold z-10 relative" title={memberName(id)}>
                          {initials(memberName(id))}
                        </div>
                      ))}
                      {projectMemberIds.length === 0 && <span className="text-xs font-mono text-muted-foreground">No members assigned.</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Open Risks (real) */}
              <div className="border border-destructive/30 bg-destructive/5">
                <div className="p-4 border-b border-destructive/20 bg-destructive/10 flex items-center justify-between">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> Open Risks ({openRisks.length})
                  </h3>
                </div>
                <div className="divide-y divide-destructive/10">
                  {openRisks.length === 0 && <div className="p-4 text-xs font-mono text-muted-foreground">No open risks.</div>}
                  {openRisks.map((r) => (
                    <div key={r.id} className="p-4">
                      <div className="text-sm font-bold mb-1">{r.title}</div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">
                        {r.risk_level ?? '—'} · Owner: {memberName(r.owner_member_id)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick info */}
              <div className="border border-border bg-background">
                <div className="p-4 border-b border-border bg-surface-hover">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                    <Layers className="w-3 h-3" /> Classification
                  </h3>
                </div>
                <div className="p-4 text-sm">
                  <span className="font-mono text-[10px] uppercase px-2 py-1 bg-surface border border-border">{project.security_classification ?? 'INTERNAL'}</span>
                </div>
              </div>

            </div>
          </div>
        ) : activeTab === 'Board' || activeTab === 'Backlog' ? (
          <div className="flex flex-col items-center justify-center h-64 border border-border border-dashed bg-surface/30 gap-3">
            <h3 className="font-mono text-sm uppercase tracking-widest font-bold">{activeTab}</h3>
            <Link href="/dashboard/tasks" className="inline-flex items-center gap-2 h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest hover:bg-surface">
              Open Task Board <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ) : activeTab === 'Sprints' ? (
          <div className="border border-border bg-background">
            {sprints === null && <div className="p-4 text-xs font-mono text-muted-foreground">Loading sprints…</div>}
            {sprints?.length === 0 && <div className="p-6 text-xs font-mono text-muted-foreground">No sprints for this project.</div>}
            <div className="divide-y divide-border">
              {sprints?.map((s) => (
                <Link key={s.id} href={`/dashboard/sprints/${s.id}`} className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                  <div>
                    <div className="text-sm font-bold">{s.name}</div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground mt-1">{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[10px] text-muted-foreground">{Number(s.completed_story_points ?? 0)}/{Number(s.planned_story_points ?? 0)} pts</span>
                    <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${statusColor(s.status)}`}>{s.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : activeTab === 'Releases' ? (
          <div className="border border-border bg-background">
            {releases === null && <div className="p-4 text-xs font-mono text-muted-foreground">Loading releases…</div>}
            {releases?.length === 0 && <div className="p-6 text-xs font-mono text-muted-foreground">No releases for this project.</div>}
            <div className="divide-y divide-border">
              {releases?.map((rel) => (
                <div key={rel.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{rel.name} {rel.version && <span className="font-mono text-[10px] text-muted-foreground">v{rel.version}</span>}</div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground mt-1">Target: {fmtDate(rel.planned_release_at)}</div>
                  </div>
                  <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${statusColor(rel.status)}`}>{rel.status.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'Team' ? (
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">
                {teamNames.length > 0 ? `Teams: ${teamNames.join(', ')}` : 'Project Members'}
              </h3>
            </div>
            {projectMemberIds.length === 0 && <div className="p-6 text-xs font-mono text-muted-foreground">No members assigned.</div>}
            <div className="divide-y divide-border">
              {projectMemberIds.map((id) => (
                <div key={id} className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center font-mono text-xs font-bold">{initials(memberName(id))}</div>
                  <div>
                    <div className="text-sm font-bold">{memberName(id)}</div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground">{members.find((m) => m.id === id)?.job_title ?? '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'Risks' ? (
          <div className="border border-border bg-background">
            {risks.length === 0 && <div className="p-6 text-xs font-mono text-muted-foreground">No risks logged.</div>}
            <div className="divide-y divide-border">
              {risks.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{r.title}</div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground mt-1">{r.risk_level ?? '—'} · Owner: {memberName(r.owner_member_id)}</div>
                  </div>
                  <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${statusColor(r.status)}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'Activity' ? (
          <div className="border border-border bg-background">
            {activity === null && <div className="p-4 text-xs font-mono text-muted-foreground">Loading activity…</div>}
            {activity?.length === 0 && <div className="p-6 text-xs font-mono text-muted-foreground">No activity recorded yet.</div>}
            <div className="divide-y divide-border">
              {activity?.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-surface border border-border flex items-center justify-center font-mono text-[10px] font-bold">{initials(memberName(a.actor_member_id))}</div>
                    <div>
                      <span className="text-sm">{a.activity_type.replace(/[._]/g, ' ')}</span>
                      {a.entity_type && <span className="font-mono text-[10px] uppercase text-muted-foreground ml-2">{a.entity_type}</span>}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">{fmtDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 border border-border border-dashed bg-surface/30">
            <h3 className="font-mono text-sm uppercase tracking-widest font-bold mb-2">{activeTab}</h3>
            <p className="text-xs text-muted-foreground font-mono">Not available yet.</p>
          </div>
        )}
      </div>

      {creating && project.id && (
        <CreateTaskModal
          projectId={project.id}
          projectLabel={project.code}
          onClose={() => setCreating(false)}
          onCreated={loadProject}
        />
      )}
    </div>
  );
}
