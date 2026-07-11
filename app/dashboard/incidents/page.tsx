'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { motion } from 'motion/react';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Download,
  FileText,
  Activity,
  ArrowRight
, AlertCircle} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';
import { DataViewport } from '@/components/layout/data-viewport';
import { AskAiButton } from '@/components/ai/ask-ai-button';
import { DeclareIncidentModal } from '@/components/incidents/declare-incident-modal';
import { CreatePostmortemModal } from '@/components/incidents/create-postmortem-modal';
import { TableRowsSkeleton } from '@/components/ui/skeleton';

const SEV_LABEL: Record<string, string> = { SEV1: 'SEV-1', SEV2: 'SEV-2', SEV3: 'SEV-3', SEV4: 'SEV-4' };
const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Investigating', INVESTIGATING: 'Investigating', IDENTIFIED: 'Mitigated',
  MONITORING: 'Mitigated', RESOLVED: 'Resolved',
};
function mapIncident(r: any) {
  const start = r.started_at ? new Date(r.started_at) : null;
  let duration = 'Ongoing';
  if (r.resolved_at && start) {
    const mins = Math.round((new Date(r.resolved_at).getTime() - start.getTime()) / 60000);
    duration = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }
  return {
    id: r.id,
    title: r.title,
    severity: SEV_LABEL[r.severity] ?? r.severity,
    status: STATUS_LABEL[r.status] ?? r.status,
    commander: r.commander?.profile?.full_name ?? '—',
    service: '—',
    impact: r.customer_impact ?? '—',
    start: start ? start.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    duration,
    release: '—',
    followUps: 0,
  };
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'SEV-1': return 'text-destructive font-bold bg-destructive/10 border-destructive';
    case 'SEV-2': return 'text-orange-500 font-bold bg-orange-500/10 border-orange-500';
    case 'SEV-3': return 'text-accent font-bold bg-accent/10 border-accent';
    case 'SEV-4': return 'text-muted-foreground font-bold bg-surface border-border';
    default: return 'text-foreground bg-surface border-border';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Investigating': return 'text-destructive border-destructive';
    case 'Mitigated': return 'text-orange-500 border-orange-500';
    case 'Resolved': return 'text-emerald-500 border-emerald-500';
    case 'Closed': return 'text-muted-foreground border-border bg-surface';
    default: return 'text-foreground border-border';
  }
};

export default function IncidentsPage() {
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [showPostmortemModal, setShowPostmortemModal] = useState(false);

  const {
    data: incidents = [],
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const rows = await apiGet<unknown[]>('/api/v1/incidents');
      return (Array.isArray(rows) ? rows : []).map(mapIncident);
    },
  });
  const error = isError ? 'Failed to load incidents.' : null;

  return (
    <>
    <WorkspaceDataLayout className="space-y-6 animate-in fade-in duration-500 flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Engineering</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Incidents</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <AlertCircle className="w-8 h-8" />
            Incidents
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Coordinate response, track impact, document root cause, and prevent recurrence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-border hover:bg-surface-hover hover:text-foreground" asChild>
            <a href="/api/v1/incidents/export-timeline" download="timeline_export.csv">
              <Download className="w-4 h-4 mr-2" />
              Export Timeline
            </a>
          </Button>
          <Button variant="outline" className="border-border hover:bg-surface-hover hover:text-foreground" onClick={() => setShowPostmortemModal(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Create Postmortem
          </Button>
          <Button 
            variant="default" 
            className="bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90"
            onClick={() => setShowDeclareModal(true)}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Declare Incident
          </Button>
          <AskAiButton intent="summarize-incidents" title="Incidents Digest" />
        </div>
      </div>

      {/* Top Controls */}
      <div className="p-3 border border-border rounded bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="SEARCH INCIDENTS..." className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <Button variant="outline" size="sm" className="h-8 px-3 rounded text-[10px] font-mono uppercase border-border bg-background">
            <Filter className="w-3 h-3 mr-2" /> Filters
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex gap-6">
        <div className="flex-1 min-w-0 border border-border rounded bg-background flex flex-col overflow-hidden">
          <DataViewport className="border-0">
            <table className="w-full min-w-[800px] text-left text-sm font-mono border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-surface-hover z-10 shadow-[0_1px_0_0_var(--border)]">
                <tr>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Incident ID</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Severity / Title</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Affected Service</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Customer Impact</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Commander</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Start Time / Duration</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Release</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Follow-ups</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <TableRowsSkeleton rows={6} cols={10} />}
                {!loading && error && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-destructive mb-3">{error}</div>
                      <Button variant="outline" size="sm" className="rounded text-xs font-mono uppercase tracking-widest" onClick={() => refetch()}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                )}
                {!loading && !error && incidents.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                      No incidents found
                    </td>
                  </tr>
                )}
                {!loading && !error && incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <Link href={`/dashboard/incidents/${inc.id}`} className="text-[10px] bg-surface border border-border rounded px-1.5 py-0.5 inline-flex text-muted-foreground group-hover:text-foreground">
                        {inc.id}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link href={`/dashboard/incidents/${inc.id}`} className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 border uppercase tracking-widest ${getSeverityColor(inc.severity)}`}>
                          {inc.severity}
                        </span>
                        <span className="font-sans font-bold text-sm truncate max-w-[200px] group-hover:underline decoration-border underline-offset-4">{inc.title}</span>
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(inc.status)} uppercase tracking-widest`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{inc.service}</td>
                    <td className="p-3 text-xs truncate max-w-[150px]">{inc.impact}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-surface border border-border rounded flex items-center justify-center font-mono text-[9px] uppercase">{inc.commander.charAt(0)}</div>
                        <span className="text-xs">{inc.commander}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">{inc.start}</div>
                      <div className="text-[10px] text-muted-foreground">{inc.duration}</div>
                    </td>
                    <td className="p-3 text-xs">{inc.release}</td>
                    <td className="p-3">
                      <span className="text-xs">{inc.followUps} tasks</span>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/dashboard/incidents/${inc.id}`} className="inline-flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataViewport>

          <div className="p-3 border-t border-border bg-surface-hover flex justify-between items-center text-[10px] font-mono text-muted-foreground flex-shrink-0">
            <span>Showing {incidents.length} incident{incidents.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
    </WorkspaceDataLayout>
    {showDeclareModal && <DeclareIncidentModal onClose={() => setShowDeclareModal(false)} onSuccess={() => { setShowDeclareModal(false); refetch(); }} />}
    {showPostmortemModal && <CreatePostmortemModal onClose={() => setShowPostmortemModal(false)} onSuccess={() => { setShowPostmortemModal(false); refetch(); }} />}
    </>
  );
}
