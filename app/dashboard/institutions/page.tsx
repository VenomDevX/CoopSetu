'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, MapPin, Users, Phone, Mail, Search } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

interface Institution {
  id: string;
  name: string;
  code: string;
  type: string;
  city?: string;
  state?: string;
  contact_email?: string;
  contact_phone?: string;
  capacity: number;
  status: string;
}

interface Stats { total: number; active: number; totalCapacity: number; }

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, totalCapacity: 0 });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', type: 'TRAINING_INSTITUTE', city: '', state: '', contact_email: '', contact_phone: '', capacity: 50 });

  const load = useCallback(() => {
    fetch('/api/v1/institutions').then(r => r.json()).then(j => {
      if (j?.data) { setInstitutions(j.data.institutions || []); setStats(j.data.stats || stats); }
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await fetch('/api/v1/institutions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ name: '', code: '', type: 'TRAINING_INSTITUTE', city: '', state: '', contact_email: '', contact_phone: '', capacity: 50 });
    load();
  };

  const filtered = institutions.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Training_ERP // Institutions
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Training Institutes</h1>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> Add Institution
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Total Institutes', value: stats.total, icon: <Building2 className="w-5 h-5" /> },
          { label: 'Active', value: stats.active, icon: <Users className="w-5 h-5" /> },
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
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">New Institution</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Institution Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Code (e.g. VAMNICOM)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="State" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Phone" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
              <div className="flex items-end">
                <Button onClick={handleCreate} className="rounded font-mono text-xs uppercase w-full">Create Institution</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search institutions..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(inst => (
          <Card key={inst.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{inst.code}</div>
                  <h3 className="font-bold text-lg text-foreground">{inst.name}</h3>
                </div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${inst.status === 'ACTIVE' ? 'border-green-500/40 text-green-500 bg-green-500/10' : 'border-border text-muted-foreground'}`}>
                  {inst.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {(inst.city || inst.state) && (
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{[inst.city, inst.state].filter(Boolean).join(', ')}</div>
                )}
                {inst.contact_email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{inst.contact_email}</div>}
                {inst.contact_phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{inst.contact_phone}</div>}
                <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" />Capacity: {inst.capacity}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No institutions found. Add your first training institute to get started.
          </div>
        )}
      </div>
    </div>
  );
}
