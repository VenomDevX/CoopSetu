'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Clock, Search, Plus, MapPin } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Batch {
  id: string;
  name: string;
  programme_id: string;
  programme_name?: string;
  trainer_id?: string;
  trainer_name?: string;
  start_date?: string;
  end_date?: string;
  capacity: number;
  room?: string;
  status: string;
}

interface Stats { total: number; active: number; totalCapacity: number; }

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programmes, setProgrammes] = useState<{id: string, title: string}[]>([]);
  const [trainers, setTrainers] = useState<{id: string, name: string}[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, totalCapacity: 0 });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', programme_id: '', trainer_id: '', start_date: '', end_date: '', capacity: 30, room: '' });

  const load = useCallback(() => {
    // Load batches
    fetch('/api/v1/batches').then(r => r.json()).then(j => {
      if (j?.data?.batches) {
        setBatches(j.data.batches);
        setStats({
          total: j.data.batches.length,
          active: j.data.batches.filter((b: Batch) => b.status === 'UPCOMING' || b.status === 'ONGOING').length,
          totalCapacity: j.data.batches.reduce((sum: number, b: Batch) => sum + (b.capacity || 0), 0)
        });
      }
    });
    // Load programmes for dropdown
    fetch('/api/v1/programmes').then(r => r.json()).then(j => {
      if (j?.data?.programmes) setProgrammes(j.data.programmes);
    });
    // Load trainers for dropdown
    fetch('/api/v1/trainers').then(r => r.json()).then(j => {
      if (j?.data?.trainers) setTrainers(j.data.trainers.map((t: any) => ({ id: t.id, name: t.profiles?.full_name })));
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.programme_id) return alert("Name and Programme are required.");
    await fetch('/api/v1/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ name: '', programme_id: '', trainer_id: '', start_date: '', end_date: '', capacity: 30, room: '' });
    load();
  };

  const filtered = batches.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.programme_name && b.programme_name.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Training_ERP // Batches
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Training Batches</h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono">Manage batches within training programmes</p>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> New Batch
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Total Batches', value: stats.total, icon: <Users className="w-5 h-5" /> },
          { label: 'Active / Upcoming', value: stats.active, icon: <Calendar className="w-5 h-5" /> },
          { label: 'Total Capacity', value: stats.totalCapacity.toLocaleString(), icon: <Users className="w-5 h-5" /> },
        ].map((s, i) => (
          <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-muted-foreground mb-6">
                <span className="font-mono text-[10px] uppercase tracking-widest">{s.label}</span>
                <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">{s.icon}</div>
              </div>
              <div className="text-4xl font-bold text-foreground tracking-tighter">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="shadow-none border-border rounded bg-background mb-8">
              <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">Create New Batch</CardTitle></CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Batch Name (e.g. BATCH-2026-A)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.programme_id} onChange={e => setForm({ ...form, programme_id: e.target.value })}>
                  <option value="">-- Select Programme --</option>
                  {programmes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.trainer_id} onChange={e => setForm({ ...form, trainer_id: e.target.value })}>
                  <option value="">-- Select Primary Trainer --</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Capacity (e.g. 30)" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
                <div className="flex items-center gap-2 border border-border rounded px-3 py-2">
                  <span className="text-xs font-mono uppercase text-muted-foreground w-20">Start:</span>
                  <input type="date" className="bg-transparent text-sm font-mono flex-1 outline-none" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 border border-border rounded px-3 py-2">
                  <span className="text-xs font-mono uppercase text-muted-foreground w-20">End:</span>
                  <input type="date" className="bg-transparent text-sm font-mono flex-1 outline-none" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
                <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Room / Location" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} />
                <div className="flex items-end md:col-span-1">
                  <Button onClick={handleCreate} className="rounded font-mono text-xs uppercase w-full">Create Batch</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search batches by name or programme..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(batch => (
          <Card key={batch.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{batch.programme_name || 'No Programme'}</div>
                  <h3 className="font-bold text-lg text-foreground">{batch.name}</h3>
                </div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${batch.status === 'ONGOING' ? 'border-green-500/40 text-green-500 bg-green-500/10' : batch.status === 'COMPLETED' ? 'border-border text-muted-foreground' : 'border-blue-500/40 text-blue-500 bg-blue-500/10'}`}>
                  {batch.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" />Trainer: {batch.trainer_name || 'Unassigned'}</div>
                {(batch.start_date || batch.end_date) && (
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />
                    {batch.start_date ? new Date(batch.start_date).toLocaleDateString() : '?'} - {batch.end_date ? new Date(batch.end_date).toLocaleDateString() : '?'}
                  </div>
                )}
                {batch.room && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />Room: {batch.room}</div>}
                <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" />Capacity: {batch.capacity} trainees</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No batches found. Create a new batch to get started.
          </div>
        )}
      </div>
    </div>
  );
}
