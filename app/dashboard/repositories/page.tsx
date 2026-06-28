'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  Bot,
  GitBranch,
  GitPullRequest,
  GitCommit,
  Activity,
  Server,
  Cloud,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  MoreVertical,
  Link2,
  ArrowRight,
  TerminalSquare,
  Box,
  Layers,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';
import { DataViewport } from '@/components/layout/data-viewport';

const tabs = [
  'Repositories',
  'Pull Requests',
  'Commits',
  'CI/CD',
  'Environments',
  'Deployments'
];


const fmtRel = (iso?: string | null) => {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};
const cap = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '—');
const PR_STATUS: Record<string, string> = { OPEN: 'Open', MERGED: 'Approved', CLOSED: 'Closed', DRAFT: 'Draft' };
const CI_STATUS: Record<string, string> = { PASSED: 'Success', FAILED: 'Failed', RUNNING: 'Running', QUEUED: 'Queued', CANCELLED: 'Failed' };

function mapRepo(r: any) {
  return {
    id: r.id, name: r.name, owner: '—', branch: r.default_branch, project: '—',
    prs: r.pull_requests?.[0]?.count ?? 0, commit: '—',
    build: 'Passing', deploy: '—', health: r.status === 'ACTIVE' ? 'Healthy' : 'At Risk'
  };
}
function mapPR(r: any) {
  return {
    key: r.id, id: r.external_id ?? r.id.slice(0, 8), title: r.title, repo: '—',
    author: r.author_member_id ? 'Assigned' : '—', reviewers: [], task: r.linked_task_id ? 'Linked' : '—',
    build: cap(r.build_status), tests: r.test_status ?? '—', status: PR_STATUS[r.status] ?? r.status,
    files: 0, risk: r.risk_level ?? 'Low', created: fmtRel(r.opened_at)
  };
}
function mapCommit(r: any) {
  return {
    key: r.id, hash: r.external_hash ?? r.id.slice(0, 7), author: r.author_member_id ? 'Assigned' : '—',
    branch: r.branch ?? '—', message: r.message ?? '', task: r.linked_task_id ? 'Linked' : '—', date: fmtRel(r.committed_at)
  };
}
function mapPipeline(r: any) {
  const jobs = r.ci_jobs ?? [];
  return {
    key: r.id, id: r.external_id ?? r.id.slice(0, 8), pipeline: r.branch ?? 'pipeline', branch: r.branch ?? '—',
    trigger: 'push', status: CI_STATUS[r.status] ?? r.status, duration: '—',
    failedJobs: jobs.filter((j: any) => j.status === 'FAILED').length, tests: '—', env: '-', time: fmtRel(r.started_at)
  };
}
function mapEnv(r: any) {
  return { name: r.name, version: '—', deployed: '—', health: 'Healthy', owner: '—', rollback: '—', release: '—' };
}
function mapDeployment(r: any) {
  return {
    key: r.id, id: r.id.slice(0, 8), project: '—', env: '—', version: r.version ?? '—',
    status: r.status === 'DEPLOYED' ? 'Success' : r.status === 'FAILED' ? 'Failed' : cap(r.status),
    trigger: r.triggered_by_member_id ? 'Manual' : 'Auto', time: fmtRel(r.started_at),
    rollback: r.rollback_of_deployment_id ? 'Initiated' : 'Available'
  };
}


const getStatusColor = (status: string) => {
  switch (status) {
    case 'Passing':
    case 'Success':
    case 'Approved':
    case 'Healthy':
      return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
    case 'Failing':
    case 'Failed':
    case 'At Risk':
    case 'Degraded':
      return 'text-destructive border-destructive bg-destructive/10';
    case 'Draft':
    case 'Open':
    case 'Available':
      return 'text-accent border-accent bg-accent/10';
    default:
      return 'text-foreground border-border bg-surface';
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

export default function RepositoriesPage() {
  const [activeTab, setActiveTab] = useState('Repositories');
  const [mockRepositories, setRepos] = useState<ReturnType<typeof mapRepo>[]>([]);
  const [mockPRs, setPRs] = useState<ReturnType<typeof mapPR>[]>([]);
  const [mockCommits, setCommits] = useState<ReturnType<typeof mapCommit>[]>([]);
  const [mockPipelines, setPipelines] = useState<ReturnType<typeof mapPipeline>[]>([]);
  const [mockEnvironments, setEnvironments] = useState<ReturnType<typeof mapEnv>[]>([]);
  const [mockDeployments, setDeployments] = useState<ReturnType<typeof mapDeployment>[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/repositories').then((r) => r.json()).then((j) => {
      if (!active) return;
      const d = j?.data ?? {};
      setRepos((d.repositories ?? []).map(mapRepo));
      setPRs((d.pullRequests ?? []).map(mapPR));
      setCommits((d.commits ?? []).map(mapCommit));
      setPipelines((d.pipelines ?? []).map(mapPipeline));
      setEnvironments((d.environments ?? []).map(mapEnv));
      setDeployments((d.deployments ?? []).map(mapDeployment));
    }).catch(() => { });
    return () => { active = false; };
  }, []);

  return (
    <WorkspaceDataLayout className="space-y-6 animate-in fade-in duration-500 flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Engineering</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Repositories</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <GitBranch className="w-8 h-8" />
            Engineering
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Connect delivery work to repositories, pull requests, pipelines, environments, and deployments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
            <TerminalSquare className="w-4 h-4" />
            Deployment Logs
          </Button>
          <Button variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
            <Rocket className="w-4 h-4" />
            Create Release
          </Button>
          <Button className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
            <Link2 className="w-4 h-4" />
            Connect Repository
          </Button>
          <Button variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-accent hover:bg-accent/10 gap-2">
            <Bot className="w-4 h-4" />
            Ask Handoff AI
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none flex-shrink-0">
        {tabs.map(tab => (
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

      {/* Top Controls */}
      <div className="p-3 border border-border bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder={`SEARCH ${activeTab.toUpperCase()}...`} className="w-full h-8 pl-8 pr-3 bg-background border border-border text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <Button variant="outline" size="sm" className="h-8 px-3 rounded-none text-[10px] font-mono uppercase border-border bg-background">
            <Filter className="w-3 h-3 mr-2" /> Filters
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex gap-6">
        <div className="flex-1 min-w-0 border border-border bg-background flex flex-col overflow-hidden">
          <DataViewport className="border-0">
            <table className="w-full min-w-[1000px] text-left text-sm font-mono border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-surface-hover z-10 shadow-[0_1px_0_0_var(--border)]">
                {activeTab === 'Repositories' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Repository</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Owner</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Project</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Branch</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Latest Commit</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">PRs</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Build</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Deploy</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Health</th>
                  </tr>
                )}
                {activeTab === 'Pull Requests' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Pull Request</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Repository</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Author</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Reviewers</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Linked Task</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Build/Tests</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Changed</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Risk</th>
                  </tr>
                )}
                {activeTab === 'Commits' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Commit</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Message</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Author</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Branch</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Task</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Date</th>
                  </tr>
                )}
                {activeTab === 'CI/CD' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Pipeline</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Branch/Trigger</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Duration</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Tests</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Environment</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Time</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal"></th>
                  </tr>
                )}
                {activeTab === 'Environments' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Environment</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Health</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Version</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Last Deployed</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Owner</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Release</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Rollback</th>
                  </tr>
                )}
                {activeTab === 'Deployments' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Deployment</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Project</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Environment</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Version</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Triggered By</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Time</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border">
                {activeTab === 'Repositories' && mockRepositories.map((repo) => (
                  <tr key={repo.id} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-muted-foreground" />
                        <span className="font-sans font-bold text-sm">{repo.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{repo.owner}</td>
                    <td className="p-3 text-xs">{repo.project}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-[10px] bg-surface border border-border px-1.5 py-0.5 inline-flex">
                        <GitBranch className="w-3 h-3" /> {repo.branch}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-[10px] bg-surface border border-border px-1.5 py-0.5 inline-flex">
                        <GitCommit className="w-3 h-3" /> {repo.commit}
                      </div>
                    </td>
                    <td className="p-3 text-xs">{repo.prs} open</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(repo.build)} uppercase tracking-widest`}>
                        {repo.build}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{repo.deploy}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(repo.health)} uppercase tracking-widest`}>
                        {repo.health}
                      </span>
                    </td>
                  </tr>
                ))}

                {activeTab === 'Pull Requests' && mockPRs.map((pr) => (
                  <tr key={pr.key} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <GitPullRequest className="w-4 h-4 text-accent" />
                        <span className="font-sans font-bold text-sm group-hover:underline decoration-border underline-offset-4">{pr.title}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{pr.id} • {pr.created}</div>
                    </td>
                    <td className="p-3 text-xs">{pr.repo}</td>
                    <td className="p-3 text-xs">{pr.author}</td>
                    <td className="p-3 text-xs">{pr.reviewers.length ? pr.reviewers.join(', ') : 'None'}</td>
                    <td className="p-3">
                      <span className="text-[10px] bg-surface border border-border px-1.5 py-0.5 hover:bg-foreground hover:text-background transition-colors cursor-pointer">
                        {pr.task}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(pr.status)} uppercase tracking-widest`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-none ${pr.build === 'Passing' ? 'bg-emerald-500' : 'bg-destructive'}`} />
                        <span className="text-xs">{pr.tests}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{pr.files} files</td>
                    <td className="p-3">
                      <span className={`font-bold text-[10px] uppercase tracking-widest ${getRiskColor(pr.risk)}`}>{pr.risk}</span>
                    </td>
                  </tr>
                ))}

                {activeTab === 'Commits' && mockCommits.map((commit) => (
                  <tr key={commit.key} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-[10px] bg-surface border border-border px-1.5 py-0.5 inline-flex text-muted-foreground group-hover:text-foreground">
                        <GitCommit className="w-3 h-3" /> {commit.hash}
                      </div>
                    </td>
                    <td className="p-3 font-sans text-sm">{commit.message}</td>
                    <td className="p-3 text-xs">{commit.author}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-[10px] bg-surface border border-border px-1.5 py-0.5 inline-flex">
                        <GitBranch className="w-3 h-3" /> {commit.branch}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] bg-surface border border-border px-1.5 py-0.5 hover:bg-foreground hover:text-background transition-colors cursor-pointer">
                        {commit.task}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{commit.date}</td>
                  </tr>
                ))}

                {activeTab === 'CI/CD' && mockPipelines.map((pl) => (
                  <tr key={pl.key} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="font-sans text-sm font-bold">{pl.pipeline}</div>
                      <div className="text-[10px] text-muted-foreground">{pl.id}</div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(pl.status)} uppercase tracking-widest`}>
                        {pl.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">{pl.branch}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{pl.trigger}</div>
                    </td>
                    <td className="p-3 text-xs">{pl.duration}</td>
                    <td className="p-3 text-xs">
                      {pl.failedJobs > 0 ? (
                        <span className="text-destructive font-bold">{pl.failedJobs} jobs failed</span>
                      ) : (
                        <span>{pl.tests} passed</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">{pl.env}</td>
                    <td className="p-3 text-xs text-muted-foreground">{pl.time}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-none text-muted-foreground hover:text-foreground">
                        <TerminalSquare className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {activeTab === 'Environments' && mockEnvironments.map((env) => (
                  <tr key={env.name} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <span className="font-sans font-bold text-sm">{env.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(env.health)} uppercase tracking-widest`}>
                        {env.health}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] bg-surface border border-border px-1.5 py-0.5">
                        {env.version}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{env.deployed}</td>
                    <td className="p-3 text-xs">{env.owner}</td>
                    <td className="p-3 text-xs">
                      {env.release !== '-' ? (
                        <span className="underline decoration-border underline-offset-4">{env.release}</span>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{env.rollback}</td>
                  </tr>
                ))}

                {activeTab === 'Deployments' && mockDeployments.map((dep) => (
                  <tr key={dep.key} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="font-sans text-sm font-bold">{dep.id}</div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(dep.status)} uppercase tracking-widest`}>
                        {dep.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{dep.project}</td>
                    <td className="p-3 text-xs">{dep.env}</td>
                    <td className="p-3">
                      <span className="text-[10px] bg-surface border border-border px-1.5 py-0.5">
                        {dep.version}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{dep.trigger}</td>
                    <td className="p-3 text-xs text-muted-foreground">{dep.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataViewport>

          <div className="p-3 border-t border-border bg-surface-hover flex justify-between items-center text-[10px] font-mono text-muted-foreground flex-shrink-0">
            <span>Showing {activeTab} data</span>
          </div>
        </div>
      </div>
    </WorkspaceDataLayout>
  );
}
