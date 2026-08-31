'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, GraduationCap, Briefcase, Search, Plus, Building2 } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Trainer {
  id: string;
  name: string;
  email?: string;
  institution_id?: string;
  institution_name?: string;
  specialization?: string;
  qualification?: string;
  experience_years?: number;
  status: string;
}

interface Stats { total: number; active: number; avgExperience: number; }

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [institutions, setInstitutions] = useState<{id: string, name: string}[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, avgExperience: 0 });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ institution_id: '', specialization: '', qualification: '', experience_years: 0 });

  const load = useCallback(() => {
    fetch('/api/v1/trainers').then(r => r.json()).then(j => {
      if (j?.data?.trainers) {
        setTrainers(j.data.trainers);
        const exp = j.data.trainers.filter((t: Trainer) => t.experience_years);
        setStats({
          total: j.data.trainers.length,
          active: j.data.trainers.filter((t: Trainer) => t.status === 'ACTIVE').length,
          avgExperience: exp.length ? Math.round(exp.reduce((s: number, t: Trainer) => s + (t.experience_years || 0), 0) / exp.length) : 0
        });
      }
    });
    fetch('/api/v1/institutions').then(r => r.json()).then(j => {
      if (j?.data?.institutions) setInstitutions(j.data.institutions);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await fetch('/api/v1/trainers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ institution_id: '', specialization: '', qualification: '', experience_years: 0 });
    load();
  };

  const filtered = trainers.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || (t.specialization && t.specialization.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Training_ERP // Trainers
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Trainer Directory</h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono">Manage trainers and their specializations</p>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> Add Trainer
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Total Trainers', value: stats.total, icon: <User className="w-5 h-5" /> },
          { label: 'Active', value: stats.active, icon: <User className="w-5 h-5" /> },
          { label: 'Avg Experience', value: `${stats.avgExperience} yrs`, icon: <Briefcase className="w-5 h-5" /> },
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
              <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">Register New Trainer</CardTitle></CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.institution_id} onChange={e => setForm({ ...form, institution_id: e.target.value })}>
                  <option value="">-- Select Institution (Optional) --</option>
                  {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Specialization (e.g. Full Stack Dev)" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} />
                <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Qualification (e.g. M.Tech CS)" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
                <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Years of Experience" value={form.experience_years} onChange={e => setForm({ ...form, experience_years: parseInt(e.target.value) || 0 })} />
                <div className="flex items-end md:col-span-2">
                  <Button onClick={handleCreate} className="rounded font-mono text-xs uppercase w-full">Register Trainer</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search trainers by name or specialization..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(trainer => (
          <Card key={trainer.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-foreground">{trainer.name}</h3>
                  <div className="font-mono text-[10px] text-muted-foreground">{trainer.email || 'No email registered'}</div>
                </div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${trainer.status === 'ACTIVE' ? 'border-green-500/40 text-green-500 bg-green-500/10' : 'border-border text-muted-foreground'}`}>
                  {trainer.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {trainer.specialization && <div className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" />{trainer.specialization}</div>}
                {trainer.qualification && <div className="flex items-center gap-2"><GraduationCap className="w-3.5 h-3.5" />{trainer.qualification}</div>}
                {trainer.experience_years !== undefined && trainer.experience_years !== null && <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" />{trainer.experience_years} Years Exp</div>}
                {trainer.institution_name && <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />{trainer.institution_name}</div>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No trainers found.
          </div>
        )}
      </div>
    </div>
  );
}
