'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, Calendar, Users, Clock, Search, Building2 } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

interface Programme {
  id: string;
  title: string;
  description?: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
  capacity: number;
  fee: number;
  status: string;
  institutions?: { name: string; code: string };
}

interface Stats { total: number; active: number; completed: number; totalCapacity: number; }

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, completed: 0, totalCapacity: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', duration_days: 30, capacity: 50, fee: 0, status: 'DRAFT' });

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    fetch(`/api/v1/programmes?${params}`).then(r => r.json()).then(j => {
      if (j?.data) { setProgrammes(j.data.programmes || []); setStats(s => j.data.stats || s); }
    });
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await fetch('/api/v1/programmes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ title: '', description: '', duration_days: 30, capacity: 50, fee: 0, status: 'DRAFT' });
    load();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'border-green-500/40 text-green-500 bg-green-500/10';
      case 'COMPLETED': return 'border-blue-500/40 text-blue-500 bg-blue-500/10';
      case 'CANCELLED': return 'border-red-500/40 text-red-500 bg-red-500/10';
      default: return 'border-border text-muted-foreground bg-surface';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Training_ERP // Programmes
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Training Programmes</h1>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> Create Programme
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {[
          { label: 'Total Programmes', value: stats.total, icon: <GraduationCap className="w-5 h-5" /> },
          { label: 'Active', value: stats.active, icon: <Clock className="w-5 h-5" /> },
          { label: 'Completed', value: stats.completed, icon: <GraduationCap className="w-5 h-5" /> },
          { label: 'Total Capacity', value: stats.totalCapacity.toLocaleString(), icon: <Users className="w-5 h-5" /> },
        ].map((s, i) => (
          <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-muted-foreground mb-6">
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
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">New Programme</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full" placeholder="Programme Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <textarea className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full h-20" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Duration (days)" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: parseInt(e.target.value) || 0 })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
              </select>
              <div className="flex items-end">
                <Button onClick={handleCreate} className="rounded font-mono text-xs uppercase w-full">Create Programme</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search programmes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['', 'DRAFT', 'ACTIVE', 'COMPLETED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded transition-colors ${statusFilter === s ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {programmes.map(prog => (
          <Card key={prog.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg text-foreground">{prog.title}</h3>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${statusColor(prog.status)}`}>{prog.status}</span>
                  </div>
                  {prog.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{prog.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{prog.duration_days} days</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Cap: {prog.capacity}</span>
                    {prog.institutions && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{prog.institutions.name}</span>}
                    {prog.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(prog.start_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {programmes.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No programmes found. Create your first training programme.
          </div>
        )}
      </div>
    </div>
  );
}
