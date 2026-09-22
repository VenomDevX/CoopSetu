'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle2, Clock, XCircle, Download, Search } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';

interface RosterEntry {
  traineeId: string;
  name: string;
  avatar: string | null;
  status: string;
  method: string | null;
  markedAt: string | null;
  source: string | null;
  recordId: string | null;
}

interface BatchOption { id: string; name: string; }

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-green-500/10 text-green-500 border-green-500/30',
  LATE: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  ABSENT: 'bg-red-500/10 text-red-500 border-red-500/30',
  EXCUSED: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
};

export default function AttendanceRegisterPage() {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  });
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [stats, setStats] = useState<{ total: number; present: number; late: number; absent: number; percentage: number }>({
    total: 0, present: 0, late: 0, absent: 0, percentage: 0,
  });
  const [batchName, setBatchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  // Load batches
  useEffect(() => {
    fetch('/api/v1/batches')
      .then(r => r.json())
      .then(j => {
        const items = (j?.data || j?.batches || []).map((b: any) => ({ id: b.id, name: b.name }));
        setBatches(items);
        setSelectedBatch(current => current || items[0]?.id || '');
      })
      .catch(() => {});
  }, []);

  const fetchRegister = useCallback(async () => {
    if (!selectedBatch) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/attendance/register?batch_id=${selectedBatch}&date=${date}`);
      const json = await res.json();
      if (json?.data) {
        setRoster(json.data.roster || []);
        setStats(json.data.stats || { total: 0, present: 0, late: 0, absent: 0, percentage: 0 });
        setBatchName(json.data.batchName || selectedBatch);
      }
    } catch (e) {
      console.error('Failed to fetch register:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBatch, date]);

  useEffect(() => {
    const timer = setTimeout(fetchRegister, 0);
    return () => clearTimeout(timer);
  }, [fetchRegister]);
  useAttendanceRealtime(fetchRegister);

  const filteredRoster = filter
    ? roster.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()))
    : roster;

  const exportCsv = () => {
    const headers = ['Name', 'Status', 'Method', 'Time'];
    const rows = roster.map(r => [
      r.name,
      r.status,
      r.method || '-',
      r.markedAt ? new Date(r.markedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${batchName}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border pb-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-foreground rounded" />
          Training_ERP // Attendance Register
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Register</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">Roster view — who&apos;s present, late, or absent</p>
      </motion.div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Batch</label>
          <select
            className="w-full px-3 py-2 border border-border rounded bg-background text-sm font-mono"
            value={selectedBatch}
            onChange={e => setSelectedBatch(e.target.value)}
          >
            <option value="">Select batch...</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Date</label>
          <input
            type="date"
            className="px-3 py-2 border border-border rounded bg-background text-sm font-mono"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={exportCsv} disabled={roster.length === 0}>
          <Download className="w-4 h-4 mr-2" /> CSV
        </Button>
      </div>

      {/* Stats */}
      {selectedBatch && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: Users, color: 'text-foreground' },
            { label: 'Present', value: stats.present, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Late', value: stats.late, icon: Clock, color: 'text-amber-500' },
            { label: 'Absent', value: stats.absent, icon: XCircle, color: 'text-red-500' },
            { label: 'Rate', value: `${stats.percentage}%`, icon: CheckCircle2, color: stats.percentage >= 75 ? 'text-green-500' : 'text-red-500' },
          ].map((s) => (
            <Card key={s.label} className="shadow-none border-border rounded bg-background">
              <CardContent className="p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{s.label}</div>
                <div className={`text-2xl font-bold tracking-tighter ${s.color}`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono"
          placeholder="Filter by name..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {/* Roster Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-xs uppercase">Loading...</div>
      ) : filteredRoster.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-xs uppercase">
          {selectedBatch ? 'No trainees enrolled in this batch' : 'Select a batch to view the register'}
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_80px_100px] gap-4 px-4 py-3 bg-surface-hover font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border hidden md:grid">
            <span>Name</span><span>Status</span><span>Method</span><span>Time</span>
          </div>
          {filteredRoster.map(entry => (
            <div
              key={entry.traineeId}
              className="grid grid-cols-1 md:grid-cols-[1fr_100px_80px_100px] gap-2 md:gap-4 px-4 py-3 border-b border-border hover:bg-surface-hover transition-colors items-center"
            >
              <span className="text-sm font-mono text-foreground">{entry.name}</span>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded w-fit ${STATUS_STYLE[entry.status] || ''}`}>
                {entry.status}
              </span>
              <span className="text-xs font-mono uppercase text-muted-foreground">{entry.method || '—'}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {entry.markedAt
                  ? new Date(entry.markedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
