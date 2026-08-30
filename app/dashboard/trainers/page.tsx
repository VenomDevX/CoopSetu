'use client';

import { Card, CardContent } from "@/components/ui/card";
import { User, Search } from 'lucide-react';
import { useState } from "react";
import { motion } from "motion/react";

export default function TrainersPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border-b border-border pb-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
          Training_ERP // Trainers
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Trainer Directory</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">Manage trainers and their specializations</p>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search trainers..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="text-center py-16">
        <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">No trainers registered yet</p>
        <p className="text-sm text-muted-foreground">Trainers are assigned to institutions and programmes.</p>
      </div>
    </div>
  );
}
