'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  Bug,
  ShieldCheck,
  CheckSquare,
  FileText,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Link2,
  Lock,
  FileCheck,
  ArrowRight,
  ShieldAlert,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiLogo } from '@/components/ai/ai-logo';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';
import { AskAiButton } from '@/components/ai/ask-ai-button';
import { DataViewport } from '@/components/layout/data-viewport';
import { CreateBugModal } from '@/components/qa-security/create-bug-modal';
import { CreateTestPlanModal } from '@/components/qa-security/create-test-plan-modal';
import { StartSecurityReviewModal } from '@/components/qa-security/start-security-review-modal';
import { TableRowsSkeleton } from '@/components/ui/skeleton';

const tabs = [
  'QA Testing',
  'Bugs',
  'Security Reviews',
  'Compliance',
  'Approvals'
];


const SEV_CAP: Record<string, string> = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const BUG_STATUS: Record<string, string> = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'In Review', CLOSED: 'Closed', WONT_FIX: 'Closed' };
const REVIEW_STATUS: Record<string, string> = { PENDING: 'In Review', IN_PROGRESS: 'In Review', APPROVED: 'Approved', REJECTED: 'Needs Revision' };
const COMPLIANCE_STATUS: Record<string, string> = { NOT_STARTED: 'Needs Review', IN_PROGRESS: 'Needs Review', COMPLIANT: 'Compliant', NON_COMPLIANT: 'At Risk' };

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—');

function mapBug(r: any) {
  return {
    id: r.id.slice(0, 8), title: r.title, severity: SEV_CAP[r.severity] ?? r.severity,
    priority: r.priority, project: '—', env: r.environment ?? '—', reporter: '—',
    assignee: r.assignee?.profile?.full_name ?? 'Unassigned', task: '—', release: '—',
    status: BUG_STATUS[r.status] ?? r.status, rootCause: r.root_cause ?? '-', created: fmtDate(r.created_at)
  };
}
function mapReview(r: any) {
  return {
    review: r.title, project: '—', vulns: '—', score: r.risk_score != null ? String(r.risk_score) : '—',
    owner: r.reviewer?.profile?.full_name ?? '—', due: fmtDate(r.due_date),
    evidence: `${r.security_review_checks?.length ?? 0} checks`, status: REVIEW_STATUS[r.status] ?? r.status, tasks: '—'
  };
}
function mapCompliance(r: any) {
  return {
    control: r.name, requirement: r.framework_name ?? '—', owner: r.owner?.profile?.full_name ?? '—',
    evidence: '—', due: fmtDate(r.due_date), status: COMPLIANCE_STATUS[r.status] ?? r.status, project: '—',
    approval: r.status === 'COMPLIANT' ? 'Approved' : 'Pending'
  };
}
function mapApproval(r: any) {
  return {
    chain: r.approval_type, type: r.required_role ?? r.approval_type,
    approver: '—', decision: r.status === 'PENDING' ? 'Pending' : r.status === 'APPROVED' ? 'Approved' : 'Rejected',
    time: fmtDate(r.created_at), comments: '—'
  };
}


const getStatusColor = (status: string) => {
  switch (status) {
    case 'Passing':
    case 'Passed':
    case 'Signed-off':
    case 'Approved':
    case 'Compliant':
      return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
    case 'Failing':
    case 'Blocked':
    case 'Needs Revision':
    case 'At Risk':
    case 'Rejected':
      return 'text-destructive border-destructive bg-destructive/10';
    case 'Pending':
    case 'In Progress':
    case 'In Review':
    case 'Needs Review':
      return 'text-accent border-accent bg-accent/10';
    default:
      return 'text-foreground border-border bg-surface';
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'Critical': return 'text-destructive font-bold';
    case 'High': return 'text-orange-500 font-bold';
    case 'Medium': return 'text-accent';
    case 'Low': return 'text-muted-foreground';
    default: return 'text-foreground';
  }
};

export default function QaSecurityPage() {
  const [activeTab, setActiveTab] = useState('Bugs');
  const [query, setQuery] = useState('');
  const [showCreateBug, setShowCreateBug] = useState(false);
  const [showCreateTestPlan, setShowCreateTestPlan] = useState(false);
  const [showSecurityReview, setShowSecurityReview] = useState(false);

  const {
    data: qaData,
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['qa-security'],
    queryFn: async () => {
      const [qa, security, approvals] = await Promise.all([
        apiGet<{ bugs?: any[]; testPlans?: any[] }>('/api/v1/qa'),
        apiGet<{ reviews?: any[]; compliance?: any[] }>('/api/v1/security'),
        apiGet<any[]>('/api/v1/approvals'),
      ]);
      return { qa, security, approvals };
    },
  });
  const error = isError ? 'Failed to load QA & security data.' : null;
  const fetchQAData = () => refetch();

  const mockBugs = (qaData?.qa?.bugs ?? []).map(mapBug);
  const mockQA = (qaData?.qa?.testPlans ?? []).map((p: any) => ({
    plan: p.title, project: '—', automated: '—', manual: '—', ratio: '—',
    regression: p.status ?? '—', uat: '—', owner: p.owner?.profile?.full_name ?? '—', release: '—',
  }));
  const mockSecurity = (qaData?.security?.reviews ?? []).map(mapReview);
  const mockCompliance = (qaData?.security?.compliance ?? []).map(mapCompliance);
  const mockApprovals = (Array.isArray(qaData?.approvals) ? qaData.approvals : []).map(mapApproval);

  // Client-side search over the active tab's primary text column.
  const q = query.trim().toLowerCase();
  const fBugs = mockBugs.filter((b) => q === '' || b.title.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
  const fQA = mockQA.filter((p) => q === '' || p.plan.toLowerCase().includes(q));
  const fSecurity = mockSecurity.filter((s) => q === '' || s.review.toLowerCase().includes(q));
  const fCompliance = mockCompliance.filter((c) => q === '' || c.control.toLowerCase().includes(q) || c.requirement.toLowerCase().includes(q));
  const fApprovals = mockApprovals.filter((a) => q === '' || a.chain.toLowerCase().includes(q) || a.type.toLowerCase().includes(q));
  const activeCount = { 'Bugs': fBugs, 'QA Testing': fQA, 'Security Reviews': fSecurity, 'Compliance': fCompliance, 'Approvals': fApprovals }[activeTab]?.length ?? 0;

  // Real summary counts derived from the loaded data (no fabricated release).
  const openBugs = mockBugs.filter((b) => b.status !== 'Closed').length;
  const criticalBugs = mockBugs.filter((b) => b.severity === 'Critical').length;
  const pendingReviews = mockSecurity.filter((s) => s.status === 'In Review').length;
  const atRiskCompliance = mockCompliance.filter((c) => c.status === 'At Risk' || c.status === 'Needs Review').length;
  const pendingApprovals = mockApprovals.filter((a) => a.decision === 'Pending').length;

  return (
    <WorkspaceDataLayout className="space-y-6 animate-in fade-in duration-500 flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Quality & Control</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">QA & Security</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <ShieldCheck className="w-8 h-8" />
            QA & Security
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Manage testing, defects, security reviews, compliance evidence, and release approvals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowSecurityReview(true)} variant="outline" className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2">
            <ShieldCheck className="w-4 h-4" />
            Start Security Review
          </Button>
          <Button onClick={() => setShowCreateTestPlan(true)} variant="outline" className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2">
            <FileCheck className="w-4 h-4" />
            Create Test Plan
          </Button>
          <Button onClick={() => setShowCreateBug(true)} className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest bg-foreground text-background gap-2">
            <Plus className="w-4 h-4" />
            Create Bug
          </Button>
          <AskAiButton intent="summarize-qa" permissions={['qa:view', 'security:view']} title="QA & Security Digest" />
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
      <div className="p-3 border border-border rounded bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`SEARCH ${activeTab.toUpperCase()}...`} className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <Button variant="outline" size="sm" disabled title="Not available yet" className="h-8 px-3 rounded text-[10px] font-mono uppercase border-border bg-background disabled:opacity-40">
            <Filter className="w-3 h-3 mr-2" /> Filters
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">

        {/* Left Column (Table) */}
        <div className="flex-1 min-w-0 border border-border rounded bg-background flex flex-col overflow-hidden">
          <DataViewport className="border-0">
            <table className="w-full min-w-[1000px] text-left text-sm font-mono border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-surface-hover z-10 shadow-[0_1px_0_0_var(--border)]">
                {activeTab === 'Bugs' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Bug ID</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Title</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Severity / Priority</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Project</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Environment</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Assignee</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Task/Release</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Created</th>
                  </tr>
                )}
                {activeTab === 'QA Testing' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Test Plan</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Project / Release</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Automated Tests</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Manual Tests</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Pass/Fail Ratio</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Regression Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">UAT Sign-off</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Owner</th>
                  </tr>
                )}
                {activeTab === 'Security Reviews' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Security Review</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Project</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Risk Score</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Vulnerabilities</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Owner</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Due Date</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Evidence</th>
                  </tr>
                )}
                {activeTab === 'Compliance' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Control</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Requirement</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Project</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Owner</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Due Date</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Approval State</th>
                  </tr>
                )}
                {activeTab === 'Approvals' && (
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Approval Chain</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Type</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Decision</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Approver</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Comments</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Timestamp</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <TableRowsSkeleton rows={6} cols={9} />}
                {!loading && error && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-destructive mb-3">{error}</div>
                      <Button variant="outline" size="sm" className="rounded text-xs font-mono uppercase tracking-widest" onClick={fetchQAData}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                )}
                {!loading && !error && activeTab === 'Bugs' && fBugs.map((bug) => (
                  <tr key={bug.id} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="text-[10px] bg-surface border border-border rounded px-1.5 py-0.5 inline-flex text-muted-foreground">
                        {bug.id}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Bug className={`w-4 h-4 ${bug.severity === 'Critical' ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="font-sans font-bold text-sm truncate max-w-[200px] group-hover:underline decoration-border underline-offset-4">{bug.title}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={getSeverityColor(bug.severity)}>{bug.severity}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="font-bold">{bug.priority}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{bug.project}</td>
                    <td className="p-3 text-xs">{bug.env}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(bug.status)} uppercase tracking-widest`}>
                        {bug.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-surface border border-border rounded flex items-center justify-center font-mono text-[9px] uppercase">{bug.assignee !== 'Unassigned' ? bug.assignee.charAt(0) : '?'}</div>
                        <span className="text-xs">{bug.assignee}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">{bug.task}</div>
                      <div className="text-[10px] text-muted-foreground">{bug.release}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{bug.created}</td>
                  </tr>
                ))}

                {!loading && !error && activeTab === 'QA Testing' && fQA.map((qa, i) => (
                  <tr key={i} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-accent" />
                        <span className="font-sans font-bold text-sm group-hover:underline decoration-border underline-offset-4">{qa.plan}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">{qa.project}</div>
                      <div className="text-[10px] text-muted-foreground">{qa.release}</div>
                    </td>
                    <td className="p-3 text-xs">{qa.automated}</td>
                    <td className="p-3 text-xs">{qa.manual}</td>
                    <td className="p-3">
                      <span className="font-bold text-sm">{qa.ratio}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(qa.regression)} uppercase tracking-widest`}>
                        {qa.regression}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(qa.uat)} uppercase tracking-widest`}>
                        {qa.uat}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{qa.owner}</td>
                  </tr>
                ))}

                {!loading && !error && activeTab === 'Security Reviews' && fSecurity.map((sec, i) => (
                  <tr key={i} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className={`w-4 h-4 ${sec.score.includes('High') ? 'text-destructive' : 'text-emerald-500'}`} />
                        <span className="font-sans font-bold text-sm group-hover:underline decoration-border underline-offset-4">{sec.review}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{sec.project}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(sec.status)} uppercase tracking-widest`}>
                        {sec.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-bold">{sec.score}</td>
                    <td className="p-3 text-xs">{sec.vulns}</td>
                    <td className="p-3 text-xs">{sec.owner}</td>
                    <td className="p-3 text-xs text-muted-foreground">{sec.due}</td>
                    <td className="p-3 text-xs flex items-center gap-1"><Link2 className="w-3 h-3" /> {sec.evidence}</td>
                  </tr>
                ))}

                {!loading && !error && activeTab === 'Compliance' && fCompliance.map((comp, i) => (
                  <tr key={i} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="text-[10px] bg-surface border border-border rounded px-1.5 py-0.5 inline-flex font-bold">
                        {comp.control}
                      </div>
                    </td>
                    <td className="p-3 font-sans text-sm">{comp.requirement}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(comp.status)} uppercase tracking-widest`}>
                        {comp.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{comp.project}</td>
                    <td className="p-3 text-xs">{comp.owner}</td>
                    <td className="p-3 text-xs text-muted-foreground">{comp.due}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(comp.approval)} uppercase tracking-widest`}>
                        {comp.approval}
                      </span>
                    </td>
                  </tr>
                ))}

                {!loading && !error && activeTab === 'Approvals' && fApprovals.map((app, i) => (
                  <tr key={i} className="hover:bg-surface-hover group cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="font-sans font-bold text-sm">{app.chain}</div>
                    </td>
                    <td className="p-3 text-xs">{app.type}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(app.decision)} uppercase tracking-widest`}>
                        {app.decision}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{app.approver}</td>
                    <td className="p-3 text-xs truncate max-w-[250px]">{app.comments}</td>
                    <td className="p-3 text-xs text-muted-foreground">{app.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataViewport>

          <div className="p-3 border-t border-border bg-surface-hover flex justify-between items-center text-[10px] font-mono text-muted-foreground flex-shrink-0">
            <span>Showing {activeCount} {activeTab.toLowerCase()} {query ? '(filtered)' : ''}</span>
          </div>
        </div>

        {/* Right Column — real quality summary derived from loaded data */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">

          {/* Quality Summary Panel */}
          <div className="border border-border rounded bg-background flex flex-col">
            <div className="p-4 border-b border-border bg-surface-hover">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Quality Summary
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-widest">Across this organization</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: 'Open Bugs', value: openBugs, alert: openBugs > 0 },
                { label: 'Critical Bugs', value: criticalBugs, alert: criticalBugs > 0 },
                { label: 'Security Reviews In Progress', value: pendingReviews, alert: false },
                { label: 'Compliance Needs Attention', value: atRiskCompliance, alert: atRiskCompliance > 0 },
                { label: 'Approvals Pending', value: pendingApprovals, alert: false },
              ].map((row) => (
                <div key={row.label} className="p-4 flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className={`font-mono font-bold ${row.alert ? 'text-destructive' : 'text-foreground'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Assistant Panel — honestly disabled (no AI wired here yet) */}
          <div className="border border-border rounded bg-surface/40 relative overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <AiLogo className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Handoff QA & Sec</h2>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-4">
              <p className="text-xs font-mono text-muted-foreground">AI analysis not available yet.</p>
              <div className="space-y-2 mt-auto">
                <Button variant="outline" size="sm" disabled title="Not available yet" className="w-full justify-start h-8 px-3 rounded text-[10px] font-mono uppercase tracking-widest border-border text-left disabled:opacity-40">
                  Draft Remediation Tasks
                </Button>
                <Button variant="outline" size="sm" disabled title="Not available yet" className="w-full justify-start h-8 px-3 rounded text-[10px] font-mono uppercase tracking-widest border-border text-left disabled:opacity-40">
                  Summarize Compliance Gaps
                </Button>
                <Button variant="outline" size="sm" disabled title="Not available yet" className="w-full justify-start h-8 px-3 rounded text-[10px] font-mono uppercase tracking-widest border-border text-left disabled:opacity-40">
                  Identify Release Risk
                </Button>
              </div>
            </div>
          </div>

        </div>

      </div>
      {showCreateBug && <CreateBugModal onClose={() => setShowCreateBug(false)} onCreated={() => { setShowCreateBug(false); fetchQAData(); }} />}
      {showCreateTestPlan && <CreateTestPlanModal onClose={() => setShowCreateTestPlan(false)} onCreated={() => { setShowCreateTestPlan(false); fetchQAData(); }} />}
      {showSecurityReview && <StartSecurityReviewModal onClose={() => setShowSecurityReview(false)} onCreated={() => { setShowSecurityReview(false); fetchQAData(); }} />}
    </WorkspaceDataLayout>
  );
}
