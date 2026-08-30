'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck, Search, GraduationCap, MapPin, Briefcase } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

interface Trainee {
  id: string;
  user_id: string;
  education?: string;
  location?: string;
  languages: string[];
  digital_literacy_level: string;
  employment_status: string;
  status: string;
  profiles?: { full_name: string; email: string };
}

interface Stats { total: number; active: number; graduated: number; employed: number; }

export default function TraineesPage() {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, graduated: 0, employed: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    fetch(`/api/v1/trainees?${params}`).then(r => r.json()).then(j => {
      if (j?.data) { setTrainees(j.data.trainees || []); setStats(j.data.stats || stats); }
    });
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const statusColor = (s: string) => {
    switch (s) { case 'ACTIVE': return 'border-green-500/40 text-green-500 bg-green-500/10'; case 'GRADUATED': return 'border-blue-500/40 text-blue-500 bg-blue-500/10'; default: return 'border-border text-muted-foreground'; }
  };

  const empColor = (s: string) => {
    switch (s) { case 'EMPLOYED': return 'text-green-500'; case 'SELF_EMPLOYED': return 'text-blue-500'; default: return 'text-muted-foreground'; }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Training_ERP // Trainees
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Registered Trainees</h1>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {[
          { label: 'Total Trainees', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Graduated', value: stats.graduated },
          { label: 'Employed', value: stats.employed },
        ].map((s, i) => (
          <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              <div className="text-3xl font-bold text-foreground tracking-tighter mt-4">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search trainees..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['', 'ACTIVE', 'GRADUATED', 'INACTIVE'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded transition-colors ${statusFilter === s ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Trainee List */}
      <div className="border border-border rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_120px_120px_100px] gap-4 px-4 py-3 bg-surface-hover font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border hidden md:grid">
          <span>Trainee</span><span>Location</span><span>Education</span><span>Employment</span><span>Status</span>
        </div>
        {trainees.map(t => (
          <div key={t.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_120px_100px] gap-2 md:gap-4 px-4 py-4 border-b border-border hover:bg-surface-hover transition-colors items-center">
            <div>
              <div className="font-bold text-sm text-foreground">{(t.profiles as any)?.full_name || 'Unknown'}</div>
              <div className="text-xs text-muted-foreground">{(t.profiles as any)?.email}</div>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{t.location || '—'}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />{t.education || '—'}</div>
            <div className={`text-xs font-mono uppercase ${empColor(t.employment_status)}`}>{t.employment_status}</div>
            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded w-fit ${statusColor(t.status)}`}>{t.status}</span>
          </div>
        ))}
        {trainees.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No trainees registered yet.
          </div>
        )}
      </div>
    </div>
  );
}
