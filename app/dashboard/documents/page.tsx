'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  Bot,
  FileText,
  Upload,
  LayoutTemplate,
  Star,
  Clock,
  Users,
  Archive,
  Edit3,
  MoreVertical,
  Link2,
  Lock,
  MessageSquare,
  History,
  CheckCircle2,
  Eye,
  Shield,
  FolderOpen,
  ArrowRight,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';
import { DataViewport } from '@/components/layout/data-viewport';

const categories = [
  'Product Requirements',
  'Technical Design',
  'Architecture',
  'API Documentation',
  'Database Documentation',
  'Runbooks',
  'Meeting Notes',
  'Security Policies',
  'Compliance Evidence',
  'Release Notes',
  'Decision Logs',
  'Team Notes'
];

const DOC_STATUS: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'In Review', APPROVED: 'Approved', ARCHIVED: 'Archived' };
const DOC_CLASS: Record<string, string> = { PUBLIC: 'Public', INTERNAL: 'Internal', CONFIDENTIAL: 'Confidential', RESTRICTED: 'Confidential' };
const DOC_CATEGORY: Record<string, string> = {
  PRD: 'Product Requirements', TECHNICAL_DESIGN: 'Architecture', ARCHITECTURE: 'Architecture',
  API_DOCUMENTATION: 'API Documentation', RUNBOOK: 'Runbooks', MEETING_NOTES: 'Meeting Notes',
  COMPLIANCE_EVIDENCE: 'Compliance Evidence', RELEASE_NOTES: 'Release Notes',
};
const fmtRel = (iso?: string | null) => {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

function mapDocument(r: any) {
  return {
    id: r.id, name: r.title, category: DOC_CATEGORY[r.document_type] ?? 'Team Note',
    owner: r.owner_member_id ? 'Owner' : '—', status: DOC_STATUS[r.status] ?? r.status,
    version: `v${r.current_version ?? 1}`, updated: fmtRel(r.updated_at),
    access: 'Organization', starred: false, classification: DOC_CLASS[r.classification] ?? 'Internal',
    project: r.project_id ? 'Linked' : '-', contributors: [] as string[],
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Published':
    case 'Approved':
      return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
    case 'In Review':
      return 'text-orange-500 border-orange-500 bg-orange-500/10';
    case 'Draft':
      return 'text-accent border-accent bg-accent/10';
    default:
      return 'text-foreground border-border bg-surface';
  }
};

const getClassificationColor = (classification: string) => {
  switch (classification) {
    case 'Confidential':
      return 'text-destructive';
    case 'Internal':
      return 'text-orange-500';
    case 'Public':
      return 'text-emerald-500';
    default:
      return 'text-muted-foreground';
  }
};

export default function DocumentsPage() {
  const [activeFilter, setActiveFilter] = useState('All Documents');
  const [query, setQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [mockDocuments, setMockDocuments] = useState<ReturnType<typeof mapDocument>[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/documents')
      .then((r) => r.json())
      .then((j) => { if (active) setMockDocuments((Array.isArray(j?.data) ? j.data : []).map(mapDocument)); })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  const selectedDoc = mockDocuments.find(d => d.id === selectedDocId);
  const draftCount = mockDocuments.filter((d) => d.status === 'Draft').length;

  // Real search (by name) + left-rail filter. Drafts/Archived/Starred and the
  // category rail map to real document fields; Recently Viewed / Shared with me
  // aren't tracked yet, so they don't apply an extra filter.
  const q = query.trim().toLowerCase();
  const filteredDocs = mockDocuments.filter((d) => {
    if (q && !d.name.toLowerCase().includes(q)) return false;
    switch (activeFilter) {
      case 'All Documents':
      case 'Recently Viewed':
      case 'Shared with me': return true;
      case 'Drafts': return d.status === 'Draft';
      case 'Archived': return d.status === 'Archived';
      case 'Starred': return d.starred;
      default: return d.category === activeFilter;
    }
  });

  return (
    <WorkspaceDataLayout className="space-y-6 animate-in fade-in duration-500 flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Knowledge</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Documents</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <FileText className="w-8 h-8" />
            Documents
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Create, manage, approve, and discover the knowledge behind delivery work.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <Upload className="w-4 h-4" />
            Import Document
          </Button>
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <LayoutTemplate className="w-4 h-4" />
            From Template
          </Button>
          <Link href="/dashboard/documents/new">
            <Button className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" />
              New Document
            </Button>
          </Link>
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-accent gap-2 disabled:opacity-40">
            <Bot className="w-4 h-4" />
            Ask Handoff AI
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">

        {/* Left Sidebar navigation */}
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-6 lg:overflow-y-auto scrollbar-thin">
          <div className="space-y-1">
            {['All Documents', 'Recently Viewed', 'Starred', 'Shared with me', 'Drafts', 'Archived'].map(item => (
              <button
                key={item}
                onClick={() => setActiveFilter(item)}
                className={`w-full text-left px-3 py-2 text-sm font-bold flex items-center justify-between border border-transparent transition-colors ${activeFilter === item ? 'bg-surface border-border text-foreground' : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground'}`}
              >
                <div className="flex items-center gap-2">
                  {item === 'Starred' && <Star className="w-4 h-4" />}
                  {item === 'Recently Viewed' && <Clock className="w-4 h-4" />}
                  {item === 'Shared with me' && <Users className="w-4 h-4" />}
                  {item === 'Drafts' && <Edit3 className="w-4 h-4" />}
                  {item === 'Archived' && <Archive className="w-4 h-4" />}
                  {item === 'All Documents' && <FolderOpen className="w-4 h-4" />}
                  {item}
                </div>
                {item === 'Drafts' && draftCount > 0 && <span className="font-mono text-[10px] px-1.5 py-0.5 bg-background border border-border">{draftCount}</span>}
              </button>
            ))}
          </div>

          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3 px-3">Categories</h3>
            <div className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center border border-transparent transition-colors ${activeFilter === cat ? 'bg-surface border-border text-foreground font-bold' : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground'}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-border mr-3" />
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Table */}
        <div className="flex-1 min-w-0 flex flex-col bg-background border border-border">
          {/* Top Controls */}
          <div className="p-3 border-b border-border bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SEARCH DOCUMENTS..." className="w-full h-8 pl-9 pr-3 bg-background border border-border text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors" />
              </div>
              <Button variant="outline" size="sm" disabled title="Not available yet" className="h-8 px-3 rounded-none text-[10px] font-mono uppercase border-border bg-background disabled:opacity-40">
                <Filter className="w-3 h-3 mr-2" /> Filters
              </Button>
            </div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
              {activeFilter}
            </div>
          </div>

          <DataViewport className="border-0">
            <table className="w-full min-w-[800px] text-left text-sm font-mono border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-surface-hover z-10 shadow-[0_1px_0_0_var(--border)]">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Name</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Category</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Status</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Owner</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Version</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Updated</th>
                  <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocs.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-xs font-mono text-muted-foreground">No documents.</td></tr>
                )}
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-surface-hover group cursor-pointer transition-colors"
                    onClick={() => setSelectedDocId(doc.id)}
                  >
                    <td className="p-3 text-center">
                      <Star className={`w-4 h-4 inline-block ${doc.starred ? 'text-orange-500 fill-orange-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity'}`} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-accent" />
                        <span className="font-sans font-bold text-sm truncate max-w-[250px] group-hover:underline decoration-border underline-offset-4">{doc.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{doc.category}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 border ${getStatusColor(doc.status)} uppercase tracking-widest`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-surface border border-border flex items-center justify-center font-mono text-[9px] uppercase">{doc.owner.charAt(0)}</div>
                        <span className="text-xs">{doc.owner}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{doc.version}</td>
                    <td className="p-3 text-xs text-muted-foreground">{doc.updated}</td>
                    <td className="p-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Shield className={`w-3 h-3 ${getClassificationColor(doc.classification)}`} />
                        {doc.access}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataViewport>
        </div>

      </div>

      {/* Document Detail Drawer */}
      <AnimatePresence>
        {selectedDocId && selectedDoc && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setSelectedDocId(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full md:w-[500px] h-full bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface-hover flex-shrink-0">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-accent" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{selectedDoc.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/documents/${selectedDoc.id}`}>
                    <Button variant="outline" size="sm" className="h-8 rounded-none border-border gap-2">
                      <Eye className="w-3 h-3" /> View Document
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="h-8 rounded-none border-border"><MoreVertical className="w-4 h-4" /></Button>
                  <button onClick={() => setSelectedDocId(null)} className="p-2 hover:bg-surface border border-transparent hover:border-border transition-colors ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">

                {/* Title & Core Fields */}
                <div>
                  <h2 className="text-2xl font-bold mb-6 tracking-tight leading-tight">{selectedDoc.name}</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border p-3 flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</span>
                      <span className={`text-[10px] w-fit px-2 py-0.5 border ${getStatusColor(selectedDoc.status)} uppercase tracking-widest mt-1`}>
                        {selectedDoc.status}
                      </span>
                    </div>
                    <div className="border border-border p-3 flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Version</span>
                      <span className="text-sm font-bold mt-1">{selectedDoc.version}</span>
                    </div>
                    <div className="border border-border p-3 flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Owner</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-5 h-5 bg-surface border border-border flex items-center justify-center font-mono text-[9px] uppercase">{selectedDoc.owner.charAt(0)}</div>
                        <span className="text-sm font-bold">{selectedDoc.owner}</span>
                      </div>
                    </div>
                    <div className="border border-border p-3 flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Data Class</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Shield className={`w-3 h-3 ${getClassificationColor(selectedDoc.classification)}`} />
                        <span className="text-sm font-bold">{selectedDoc.classification}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Handoff Assistant Panel — honestly disabled (no AI wired here yet) */}
                <div className="border border-border bg-surface/40 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Handoff Insights</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled title="Not available yet" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border disabled:opacity-40">
                      Summarize Document
                    </Button>
                    <Button variant="outline" size="sm" disabled title="Not available yet" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border disabled:opacity-40">
                      Extract Action Items
                    </Button>
                    <Button variant="outline" size="sm" disabled title="Not available yet" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border disabled:opacity-40">
                      Find Outdated Sections
                    </Button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-4">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2 flex items-center gap-2">
                    <FolderOpen className="w-3 h-3" /> Details
                  </h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Category</div>
                      <div>{selectedDoc.category}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Access</div>
                      <div>{selectedDoc.access}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Last Updated</div>
                      <div>{selectedDoc.updated}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Contributors</div>
                      <div className="flex items-center gap-1">
                        {selectedDoc.contributors.length > 0 ? (
                          <div className="flex -space-x-2">
                            {selectedDoc.contributors.map((c, i) => (
                              <div key={i} className="w-6 h-6 bg-surface border border-border flex items-center justify-center font-mono text-[9px] uppercase z-10">{c.charAt(0)}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linked Work */}
                <div className="space-y-4">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2 flex items-center gap-2">
                    <Link2 className="w-3 h-3" /> Linked Work
                  </h3>
                  <div className="space-y-2">
                    {selectedDoc.project !== '-' ? (
                      <a href="#" className="flex items-center justify-between p-2 border border-border bg-surface-hover hover:border-foreground transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-sans font-bold">{selectedDoc.project}</span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase border border-border px-1.5 py-0.5 bg-background">Project</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <div className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border">No linked work items.</div>
                    )}
                  </div>
                </div>

                {/* Activity */}
                <div className="space-y-4 pt-4">
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2 flex items-center gap-2">
                    <History className="w-3 h-3" /> Recent Activity
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-6 h-6 bg-surface border border-border flex items-center justify-center font-mono text-[9px] uppercase flex-shrink-0 mt-0.5">{selectedDoc.owner.charAt(0)}</div>
                      <div className="flex-1">
                        <p className="text-sm">Document last updated</p>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{selectedDoc.updated}</div>
                      </div>
                    </div>
                    {selectedDoc.status === 'Approved' && (
                      <div className="flex gap-4">
                        <div className="w-6 h-6 bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">Current status: <span className="font-bold">Approved</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </WorkspaceDataLayout>
  );
}
