'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus, MapPin, DollarSign, Clock, Search, Users, Building2, CheckCircle2 } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { usePermission } from "@/lib/permissions/context";

interface Job {
  id: string;
  title: string;
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  employment_type: string;
  experience_min: number;
  experience_max?: number;
  vacancies: number;
  deadline?: string;
  status: string;
  employers?: { company_name: string; location?: string; logo_url?: string };
  job_skills?: { skills: { name: string; category: string } }[];
}

interface Stats { total: number; open: number; closed: number; filled: number; }

export default function JobsPage() {
  const { hasRole } = usePermission();
  const isTrainee = hasRole('TRAINEE');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, closed: 0, filled: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ employer_id: '', title: '', description: '', location: '', salary_min: 0, salary_max: 0, employment_type: 'FULL_TIME', experience_min: 0, vacancies: 1 });
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applyError, setApplyError] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    fetch(`/api/v1/jobs?${params}`).then(r => r.json()).then(j => {
      if (j?.data) { setJobs(j.data.jobs || []); setStats(s => j.data.stats || s); }
    });
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await fetch('/api/v1/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ employer_id: '', title: '', description: '', location: '', salary_min: 0, salary_max: 0, employment_type: 'FULL_TIME', experience_min: 0, vacancies: 1 });
    load();
  };

  const handleApply = async (jobId: string) => {
    setApplyingTo(jobId);
    setApplyError(prev => { const next = { ...prev }; delete next[jobId]; return next; });
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const j = await res.json();
      if (!res.ok) {
        // Already-applied (409) is a benign state, not an error — just show it as applied.
        if (res.status === 409) { setApplied(prev => new Set(prev).add(jobId)); return; }
        throw new Error(j?.error || 'Failed to apply.');
      }
      setApplied(prev => new Set(prev).add(jobId));
    } catch (err: any) {
      setApplyError(prev => ({ ...prev, [jobId]: err.message }));
    } finally {
      setApplyingTo(null);
    }
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Not specified';
    if (min && max) return `₹${(min/1000).toFixed(0)}K - ₹${(max/1000).toFixed(0)}K`;
    if (min) return `₹${(min/1000).toFixed(0)}K+`;
    return `Up to ₹${((max || 0)/1000).toFixed(0)}K`;
  };

  const statusColor = (s: string) => {
    switch (s) { case 'OPEN': return 'border-green-500/40 text-green-500 bg-green-500/10'; case 'FILLED': return 'border-blue-500/40 text-blue-500 bg-blue-500/10'; case 'CLOSED': case 'EXPIRED': return 'border-red-500/40 text-red-500 bg-red-500/10'; default: return 'border-border text-muted-foreground'; }
  };

  const typeLabel = (t: string) => t.replace('_', ' ');

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Employment // Job Board
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Employment Exchange</h1>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> Post Job
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {[
          { label: 'Total Jobs', value: stats.total, icon: <Briefcase className="w-5 h-5" /> },
          { label: 'Open', value: stats.open, icon: <Users className="w-5 h-5" /> },
          { label: 'Filled', value: stats.filled, icon: <Briefcase className="w-5 h-5" /> },
          { label: 'Closed', value: stats.closed, icon: <Clock className="w-5 h-5" /> },
        ].map((s, i) => (
          <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="font-mono text-[10px] uppercase tracking-widest">{s.label}</span>
                <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">{s.icon}</div>
              </div>
              <div className="text-3xl font-bold text-foreground tracking-tighter">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">Post New Job</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Employer ID" value={form.employer_id} onChange={e => setForm({ ...form, employer_id: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Job Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <textarea className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full h-20" placeholder="Job Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value })}>
                <option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option>
              </select>
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Min Salary" value={form.salary_min || ''} onChange={e => setForm({ ...form, salary_min: parseInt(e.target.value) || 0 })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Max Salary" value={form.salary_max || ''} onChange={e => setForm({ ...form, salary_max: parseInt(e.target.value) || 0 })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Vacancies" value={form.vacancies} onChange={e => setForm({ ...form, vacancies: parseInt(e.target.value) || 1 })} />
              <div className="flex items-end"><Button onClick={handleCreate} className="rounded font-mono text-xs uppercase w-full">Post Job</Button></div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['', 'OPEN', 'FILLED', 'CLOSED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded transition-colors ${statusFilter === s ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-4">
        {jobs.map(job => (
          <Card key={job.id} data-testid={`job-card-${job.id}`} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg text-foreground">{job.title}</h3>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${statusColor(job.status)}`}>{job.status}</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">{typeLabel(job.employment_type)}</span>
                  </div>
                  {job.employers && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Building2 className="w-3.5 h-3.5" /> {job.employers.company_name}
                    </div>
                  )}
                  {job.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                    <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{formatSalary(job.salary_min, job.salary_max)}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.experience_min}+ yrs</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{job.vacancies} vacancies</span>
                  </div>
                  {job.job_skills && job.job_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {job.job_skills.map((js, i) => (
                        <span key={i} className="text-[9px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">{(js.skills as any)?.name}</span>
                      ))}
                    </div>
                  )}
                  {isTrainee && applyError[job.id] && (
                    <div className="text-xs font-mono text-destructive mt-3">{applyError[job.id]}</div>
                  )}
                </div>
                {isTrainee && (
                  <div className="shrink-0">
                    {applied.has(job.id) ? (
                      <span className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-widest border border-green-500/40 text-green-500 bg-green-500/10 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="rounded font-mono text-xs uppercase"
                        disabled={applyingTo === job.id || job.status !== 'OPEN'}
                        onClick={() => handleApply(job.id)}
                      >
                        {applyingTo === job.id ? 'Applying…' : 'Apply'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No jobs posted yet. Create your first job listing.
          </div>
        )}
      </div>
    </div>
  );
}
