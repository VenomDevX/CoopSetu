'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, ChevronDown, ChevronUp, Search, Mail } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

interface Job {
  id: string;
  title: string;
  status: string;
  employers?: { company_name: string };
}

interface Application {
  id: string;
  trainee_id: string;
  status: string;
  match_score: number;
  applied_at: string;
  trainees?: { id: string; profiles?: { full_name: string; email: string } };
}

const STATUS_OPTIONS = ['APPLIED', 'REVIEWED', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];

const statusColor = (s: string) => {
  switch (s) {
    case 'SHORTLISTED': case 'OFFERED': case 'ACCEPTED': return 'border-green-500/40 text-green-500 bg-green-500/10';
    case 'REJECTED': case 'WITHDRAWN': return 'border-red-500/40 text-red-500 bg-red-500/10';
    case 'INTERVIEWED': return 'border-blue-500/40 text-blue-500 bg-blue-500/10';
    default: return 'border-border text-muted-foreground';
  }
};

export default function ApplicationsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, Application[]>>({});
  const [loadingApplications, setLoadingApplications] = useState<string | null>(null);

  const loadJobs = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/v1/jobs?${params}`).then(r => r.json()).then(j => {
      if (j?.data) setJobs(j.data.jobs || []);
    });
  }, [search]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const loadApplications = async (jobId: string) => {
    setLoadingApplications(jobId);
    const res = await fetch(`/api/v1/jobs/${jobId}/applications`);
    const j = await res.json();
    setApplicationsByJob(prev => ({ ...prev, [jobId]: j?.data?.applications || [] }));
    setLoadingApplications(null);
  };

  const toggleExpand = (jobId: string) => {
    if (expanded === jobId) { setExpanded(null); return; }
    setExpanded(jobId);
    if (!applicationsByJob[jobId]) loadApplications(jobId);
  };

  const updateStatus = async (jobId: string, applicationId: string, status: string) => {
    const res = await fetch(`/api/v1/jobs/${jobId}/applications/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) loadApplications(jobId);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border-b border-border pb-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
          Employment // Candidate Applications
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Applications</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">Review and shortlist candidates who applied to your job postings</p>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-3">
        {jobs.map(job => {
          const isOpen = expanded === job.id;
          const applications = applicationsByJob[job.id] || [];
          return (
            <Card key={job.id} data-testid={`job-card-${job.id}`} className="shadow-none border-border rounded bg-background">
              <button className="w-full text-left" onClick={() => toggleExpand(job.id)}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{job.title}</h3>
                    {job.employers && <div className="text-xs text-muted-foreground font-mono mt-1">{job.employers.company_name}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    {isOpen && applications.length > 0 && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">{applications.length} applicant{applications.length === 1 ? '' : 's'}</span>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </CardContent>
              </button>

              {isOpen && (
                <div className="border-t border-border p-6 space-y-3">
                  {loadingApplications === job.id && (
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Loading…</div>
                  )}
                  {loadingApplications !== job.id && applications.length === 0 && (
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">No applications yet.</div>
                  )}
                  {applications.map(app => (
                    <div key={app.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border border-border rounded">
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-muted-foreground" />
                          {app.trainees?.profiles?.full_name || 'Trainee'}
                        </div>
                        {app.trainees?.profiles?.email && (
                          <div className="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {app.trainees.profiles.email}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-widest">
                          Match: {app.match_score}% &middot; Applied {new Date(app.applied_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${statusColor(app.status)}`}>{app.status}</span>
                        <select
                          className="px-2 py-1 border border-border rounded bg-background text-[10px] font-mono uppercase"
                          value={app.status}
                          onChange={e => updateStatus(job.id, app.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded font-mono text-[10px] uppercase"
                          disabled={app.status === 'SHORTLISTED'}
                          onClick={() => updateStatus(job.id, app.id, 'SHORTLISTED')}
                        >
                          Shortlist
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {jobs.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No jobs posted yet.
          </div>
        )}
      </div>
    </div>
  );
}
