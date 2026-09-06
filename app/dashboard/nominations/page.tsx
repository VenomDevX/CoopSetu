'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  UserPlus, Plus, Search, CheckCircle2, XCircle, GraduationCap,
  Clock, Users, ClipboardList,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePermission } from '@/lib/permissions/context';
import { useIsNative } from '@/components/native/native-provider';

interface Enrollment {
  id: string;
  status: string;
  source: string;
  remarks?: string | null;
  batch_id?: string | null;
  created_at: string;
  trainees?: { id: string; education?: string; location?: string; profiles?: { full_name?: string; email?: string } };
  programmes?: { title: string };
  batches?: { name: string } | null;
}
interface Stats {
  total: number; pending: number; approved: number; rejected: number;
  enrolled: number; completed: number; dropped: number;
  nominated: number; selfRegistered: number;
}

const EMPTY_STATS: Stats = {
  total: 0, pending: 0, approved: 0, rejected: 0,
  enrolled: 0, completed: 0, dropped: 0, nominated: 0, selfRegistered: 0,
};

// Mirrors ALLOWED_TRANSITIONS in services/enrollment.service.ts. Duplicated
// deliberately: the server is authoritative and re-checks, but a queue that
// offers a button the API will reject is worse than one that doesn't show it.
const NEXT_ACTIONS: Record<string, { label: string; status: string; tone: 'ok' | 'bad' }[]> = {
  PENDING:  [{ label: 'Approve', status: 'APPROVED', tone: 'ok' }, { label: 'Reject', status: 'REJECTED', tone: 'bad' }],
  APPROVED: [{ label: 'Enrol in batch', status: 'ENROLLED', tone: 'ok' }, { label: 'Reject', status: 'REJECTED', tone: 'bad' }],
  ENROLLED: [{ label: 'Mark complete', status: 'COMPLETED', tone: 'ok' }, { label: 'Drop', status: 'DROPPED', tone: 'bad' }],
};

const statusColor = (s: string) => {
  switch (s) {
    case 'PENDING':   return 'border-yellow-500/40 text-yellow-500 bg-yellow-500/10';
    case 'APPROVED':  return 'border-blue-500/40 text-blue-500 bg-blue-500/10';
    case 'ENROLLED':  return 'border-green-500/40 text-green-500 bg-green-500/10';
    case 'COMPLETED': return 'border-accent/40 text-accent bg-accent/10';
    case 'REJECTED':
    case 'DROPPED':   return 'border-red-500/40 text-red-500 bg-red-500/10';
    default:          return 'border-border text-muted-foreground bg-surface';
  }
};

export default function NominationsPage() {
  const isNative = useIsNative();
  const { hasRole } = usePermission();
  const isTrainee = hasRole('TRAINEE');

  const [rows, setRows] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ trainee_id: '', programme_id: '', remarks: '' });

  // Non-async on purpose, matching app/dashboard/programmes/page.tsx: the
  // react-hooks/set-state-in-effect rule follows an `await` back to the effect
  // and calls the update synchronous, but does not trace into a .then()
  // callback. Same behaviour, and it keeps the lane consistent with the other
  // Training_ERP pages.
  const load = useCallback(() => {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    fetch(`/api/v1/enrollments${qs}`).then((r) => r.json()).then((j) => {
      setRows(j?.data?.enrollments || []);
      setStats(j?.data?.stats || EMPTY_STATS);
    });
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Reference data for the nomination form and the batch picker. Fetched once;
  // these change far less often than the queue itself.
  const loadRefData = useCallback(() => {
    Promise.all([
      fetch('/api/v1/programmes').then((r) => r.json()),
      fetch('/api/v1/trainees').then((r) => r.json()),
      fetch('/api/v1/batches').then((r) => r.json()),
    ]).then(([p, t, b]) => {
      setProgrammes(p?.data?.programmes || []);
      setTrainees(t?.data?.trainees || []);
      setBatches(b?.data?.batches || []);
    });
  }, []);

  useEffect(() => { loadRefData(); }, [loadRefData]);

  const nominate = async () => {
    setError('');
    if (!form.trainee_id || !form.programme_id) {
      setError('Choose a trainee and a programme.');
      return;
    }
    const res = await fetch('/api/v1/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, source: isTrainee ? 'SELF' : 'NOMINATED' }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error || 'Could not create the nomination.'); return; }
    setShowCreate(false);
    setForm({ trainee_id: '', programme_id: '', remarks: '' });
    load();
  };

  const act = async (row: Enrollment, status: string) => {
    setError('');
    // Enrolling needs a seat. Ask here rather than failing server-side, which
    // is the only transition that carries extra data.
    let batch_id: string | undefined;
    if (status === 'ENROLLED' && !row.batch_id) {
      const options = batches.map((b, i) => `${i + 1}. ${b.name}`).join('\n');
      const pick = window.prompt(`Assign a batch:\n${options}\n\nEnter a number:`);
      const idx = Number(pick) - 1;
      if (!batches[idx]) return;
      batch_id = batches[idx].id;
    }
    setBusyId(row.id);
    const res = await fetch(`/api/v1/enrollments/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, batch_id }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) { setError(json?.error || 'That change was rejected.'); return; }
    load();
  };

  const visible = rows.filter((r) => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (
      (r.trainees?.profiles?.full_name || '').toLowerCase().includes(t) ||
      (r.programmes?.title || '').toLowerCase().includes(t)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6"
      >
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Training_ERP // Nominations
          </div>
          {!isNative && (
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">
              Nominations
            </h1>
          )}
          <p className="text-sm text-muted-foreground mt-2 font-mono">
            Registration and nomination pipeline — pending to certified.
          </p>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> {isTrainee ? 'Apply to programme' : 'Nominate candidate'}
        </Button>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Pending',   value: stats.pending,   icon: <Clock className="w-5 h-5" /> },
          { label: 'Approved',  value: stats.approved,  icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'Enrolled',  value: stats.enrolled,  icon: <Users className="w-5 h-5" /> },
          { label: 'Completed', value: stats.completed, icon: <GraduationCap className="w-5 h-5" /> },
          { label: 'Nominated', value: stats.nominated, icon: <ClipboardList className="w-5 h-5" /> },
        ].map((s, i) => (
          <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-muted-foreground mb-5">
                <span className="font-mono text-[10px] uppercase tracking-widest">{s.label}</span>
                <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">{s.icon}</div>
              </div>
              <div className="text-3xl font-bold text-foreground tracking-tighter">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-500 rounded px-4 py-3 text-sm font-mono">
          {error}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="shadow-none border-border rounded bg-background">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xs font-mono uppercase tracking-widest">
                  {isTrainee ? 'Apply to a programme' : 'Nominate a candidate'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className="px-3 py-2 border border-border rounded bg-background text-sm font-mono"
                  value={form.trainee_id}
                  onChange={(e) => setForm({ ...form, trainee_id: e.target.value })}
                >
                  <option value="">-- Select trainee --</option>
                  {trainees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.profiles?.full_name || t.education || t.id.slice(0, 8)}
                      {t.location ? ` — ${t.location}` : ''}
                    </option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 border border-border rounded bg-background text-sm font-mono"
                  value={form.programme_id}
                  onChange={(e) => setForm({ ...form, programme_id: e.target.value })}
                >
                  <option value="">-- Select programme --</option>
                  {programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <textarea
                  className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full h-20"
                  placeholder="Reason for nomination (optional)"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                />
                <div className="col-span-full flex justify-end">
                  <Button onClick={nominate} className="rounded font-mono text-xs uppercase">
                    <UserPlus className="w-4 h-4 mr-2" /> Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest"
            placeholder="Search by trainee or programme..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['PENDING', 'APPROVED', 'ENROLLED', 'COMPLETED', 'REJECTED', ''].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded transition-colors ${
                statusFilter === s ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visible.map((r) => (
          <Card key={r.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-bold text-foreground truncate">
                    {r.trainees?.profiles?.full_name || 'Unnamed trainee'}
                  </h3>
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${statusColor(r.status)}`}>{r.status}</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">
                    {r.source === 'NOMINATED' ? 'Nominated' : 'Self-applied'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {r.programmes?.title || '—'}
                  {r.batches?.name ? ` · ${r.batches.name}` : ''}
                  {r.trainees?.location ? ` · ${r.trainees.location}` : ''}
                </p>
                {r.remarks && <p className="text-xs text-muted-foreground mt-1 italic">{r.remarks}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {(NEXT_ACTIONS[r.status] || []).map((a) => (
                  <Button
                    key={a.status}
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => act(r, a.status)}
                    className={`rounded font-mono text-[10px] uppercase tracking-widest ${
                      a.tone === 'bad' ? 'text-red-500 hover:bg-red-500/10' : ''
                    }`}
                  >
                    {a.tone === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                    {a.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {visible.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No {statusFilter ? statusFilter.toLowerCase() : ''} nominations.
          </div>
        )}
      </div>
    </div>
  );
}
