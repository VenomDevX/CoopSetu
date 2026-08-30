'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BriefcaseBusiness, Plus, MapPin, Building2, Globe, Search } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

interface Employer {
  id: string;
  company_name: string;
  industry?: string;
  company_size?: string;
  location?: string;
  website?: string;
  description?: string;
  status: string;
}

export default function EmployersPage() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ user_id: '', company_name: '', industry: '', company_size: '', location: '', website: '', description: '' });

  const load = useCallback(() => {
    fetch('/api/v1/jobs').then(r => r.json()).then(j => {
      // Employers are loaded separately but for now we fetch from the jobs endpoint context
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employers.filter(e => !search || e.company_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Employment // Employer Portal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Employer Directory</h1>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> Register Employer
        </Button>
      </motion.div>

      {/* Create Form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">Register New Employer</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Company Name" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Industry" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.company_size} onChange={e => setForm({ ...form, company_size: e.target.value })}>
                <option value="">Company Size</option><option value="1-10">1-10</option><option value="11-50">11-50</option><option value="51-200">51-200</option><option value="201-500">201-500</option><option value="500+">500+</option>
              </select>
              <textarea className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full h-20" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="col-span-full"><Button className="rounded font-mono text-xs uppercase">Register Employer</Button></div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search employers..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Employer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(emp => (
          <Card key={emp.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded bg-surface-hover border border-border flex items-center justify-center shrink-0">
                  <BriefcaseBusiness className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground mb-1">{emp.company_name}</h3>
                  {emp.industry && <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">{emp.industry}</span>}
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                    {emp.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{emp.location}</span>}
                    {emp.company_size && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{emp.company_size} employees</span>}
                    {emp.website && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{emp.website}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No employers registered yet. Employers can post jobs once registered.
          </div>
        )}
      </div>
    </div>
  );
}
