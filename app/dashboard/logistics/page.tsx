'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarDays, BedDouble, Plus, Send, DoorOpen, UtensilsCrossed,
  Clock, MapPin, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsNative } from '@/components/native/native-provider';

/**
 * Timetable, hostel and mess — PS 26087's logistics requirement, none of which
 * existed before. Two tabs rather than two pages because they are the same job:
 * planning where people are and when.
 */

const TABS = ['Timetable', 'Hostel & Mess'] as const;
type Tab = (typeof TABS)[number];

const statusColor = (s: string) => {
  switch (s) {
    case 'PUBLISHED': return 'border-green-500/40 text-green-500 bg-green-500/10';
    case 'CANCELLED': return 'border-red-500/40 text-red-500 bg-red-500/10';
    default:          return 'border-border text-muted-foreground bg-surface';
  }
};

export default function LogisticsPage() {
  const isNative = useIsNative();
  const [tab, setTab] = useState<Tab>('Timetable');
  const [error, setError] = useState('');

  // reference data
  const [batches, setBatches] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);

  // timetable
  const [slots, setSlots] = useState<any[]>([]);
  const [showSlot, setShowSlot] = useState(false);
  const [slotForm, setSlotForm] = useState({
    batch_id: '', room_id: '', trainer_id: '', title: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '10:00', end_time: '11:00', session_type: 'LECTURE',
  });

  // hostel
  const [hostels, setHostels] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [mess, setMess] = useState<{ total: number; byDiet: Record<string, number> }>({ total: 0, byDiet: {} });
  const [showHostel, setShowHostel] = useState(false);
  const [hostelForm, setHostelForm] = useState({ name: '', institution_id: '', gender: 'ANY', total_beds: 40, warden_name: '' });
  const [allocForm, setAllocForm] = useState({ hostel_id: '', trainee_id: '', room_number: '', dietary_preference: 'VEG' });

  const loadRef = useCallback(() => {
    Promise.all([
      fetch('/api/v1/batches').then((r) => r.json()),
      fetch('/api/v1/rooms').then((r) => r.json()),
      fetch('/api/v1/trainers').then((r) => r.json()),
      fetch('/api/v1/trainees').then((r) => r.json()),
      fetch('/api/v1/institutions').then((r) => r.json()),
    ]).then(([b, r, tr, te, i]) => {
      setBatches(b?.data?.batches || []);
      setRooms(r?.data?.rooms || []);
      setTrainers(tr?.data?.trainers || []);
      setTrainees(te?.data?.trainees || []);
      setInstitutions(i?.data?.institutions || []);
    });
  }, []);

  const loadSlots = useCallback(() => {
    fetch('/api/v1/timetable').then((r) => r.json()).then((j) => setSlots(j?.data?.slots || []));
  }, []);

  const loadHostels = useCallback(() => {
    fetch('/api/v1/hostels').then((r) => r.json()).then((j) => {
      setHostels(j?.data?.hostels || []);
      setAllocations(j?.data?.allocations || []);
      setMess(j?.data?.mess || { total: 0, byDiet: {} });
    });
  }, []);

  useEffect(() => { loadRef(); }, [loadRef]);
  useEffect(() => { loadSlots(); }, [loadSlots]);
  useEffect(() => { loadHostels(); }, [loadHostels]);

  const post = async (url: string, body: unknown, onOk: () => void, method: 'POST' | 'PATCH' = 'POST') => {
    setError('');
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error || 'That did not work.'); return; }
    onOk();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="border-b border-border pb-6"
      >
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
          Training_ERP // Logistics
        </div>
        {!isNative && (
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Logistics</h1>
        )}
        <p className="text-sm text-muted-foreground mt-2 font-mono">
          Timetable, room allocation, hostel occupancy and mess head-count.
        </p>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-native-tap
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors border rounded ${
              tab === t ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-500 rounded px-4 py-3 text-sm font-mono flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {tab === 'Timetable' && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" data-native-tap className="rounded font-mono text-xs uppercase" onClick={() => setShowSlot(!showSlot)}>
              <Plus className="w-4 h-4 mr-2" /> Schedule session
            </Button>
          </div>

          <AnimatePresence>
            {showSlot && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Card className="shadow-none border-border rounded bg-background">
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-xs font-mono uppercase tracking-widest">New timetable slot</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className={FIELD} placeholder="Session title" value={slotForm.title}
                      onChange={(e) => setSlotForm({ ...slotForm, title: e.target.value })} />
                    <select className={FIELD} value={slotForm.batch_id} onChange={(e) => setSlotForm({ ...slotForm, batch_id: e.target.value })}>
                      <option value="">-- Batch --</option>
                      {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select className={FIELD} value={slotForm.room_id} onChange={(e) => setSlotForm({ ...slotForm, room_id: e.target.value })}>
                      <option value="">-- Room (optional) --</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity})</option>)}
                    </select>
                    <select className={FIELD} value={slotForm.trainer_id} onChange={(e) => setSlotForm({ ...slotForm, trainer_id: e.target.value })}>
                      <option value="">-- Trainer (optional) --</option>
                      {trainers.map((t) => <option key={t.id} value={t.id}>{t.profiles?.full_name || t.specialization || t.id.slice(0, 8)}</option>)}
                    </select>
                    <input type="date" className={FIELD} value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} />
                    <select className={FIELD} value={slotForm.session_type} onChange={(e) => setSlotForm({ ...slotForm, session_type: e.target.value })}>
                      {['LECTURE', 'LAB', 'WORKSHOP', 'EXAM'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="time" className={FIELD} value={slotForm.start_time} onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })} />
                    <input type="time" className={FIELD} value={slotForm.end_time} onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })} />
                    <div className="col-span-full flex justify-end">
                      <Button data-native-tap className="rounded font-mono text-xs uppercase"
                        onClick={() => post('/api/v1/timetable', slotForm, () => { setShowSlot(false); loadSlots(); })}>
                        Add slot
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {slots.map((s) => (
              <Card key={s.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground w-40 shrink-0">
                    <div className="text-foreground">{s.date}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground truncate">{s.title}</h3>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${statusColor(s.status)}`}>{s.status}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">{s.session_type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {s.batches?.name}
                      {s.rooms?.name ? <> · <MapPin className="w-3 h-3 inline" /> {s.rooms.name}</> : ''}
                      {s.trainers?.profiles?.full_name ? ` · ${s.trainers.profiles.full_name}` : ''}
                    </p>
                  </div>
                  {s.status !== 'PUBLISHED' && (
                    <Button variant="outline" data-native-tap className="rounded font-mono text-[10px] uppercase tracking-widest shrink-0"
                      onClick={() => post(`/api/v1/timetable/${s.id}/publish`, {}, loadSlots)}>
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Publish
                    </Button>
                  )}
                  {s.attendance_session_id && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-green-500 shrink-0">
                      Register open
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
            {!slots.length && (
              <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Nothing scheduled. Publishing a slot opens its attendance register.
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'Hostel & Mess' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Hostels" value={hostels.length} icon={<BedDouble className="w-5 h-5" />} />
            <Stat label="Occupied beds" value={hostels.reduce((a, h) => a + (h.occupied || 0), 0)} icon={<DoorOpen className="w-5 h-5" />} />
            <Stat label="Beds free" value={hostels.reduce((a, h) => a + (h.available || 0), 0)} icon={<BedDouble className="w-5 h-5" />} />
            <Stat label="On mess" value={mess.total} icon={<UtensilsCrossed className="w-5 h-5" />} />
          </div>

          {mess.total > 0 && (
            <div className="border border-border rounded p-4 bg-surface flex flex-wrap gap-3 items-center">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <UtensilsCrossed className="w-3 h-3 inline mr-1" /> Tomorrow&apos;s head-count
              </span>
              {Object.entries(mess.byDiet).map(([diet, n]) => (
                <span key={diet} className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-border rounded">
                  {diet.replace('_', '-')}: <strong className="text-foreground">{n}</strong>
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" data-native-tap className="rounded font-mono text-xs uppercase" onClick={() => setShowHostel(!showHostel)}>
              <Plus className="w-4 h-4 mr-2" /> Add hostel
            </Button>
          </div>

          <AnimatePresence>
            {showHostel && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Card className="shadow-none border-border rounded bg-background">
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className={FIELD} placeholder="Hostel name" value={hostelForm.name}
                      onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })} />
                    <select className={FIELD} value={hostelForm.institution_id} onChange={(e) => setHostelForm({ ...hostelForm, institution_id: e.target.value })}>
                      <option value="">-- Institute --</option>
                      {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <select className={FIELD} value={hostelForm.gender} onChange={(e) => setHostelForm({ ...hostelForm, gender: e.target.value })}>
                      {['ANY', 'MALE', 'FEMALE'].map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input type="number" className={FIELD} placeholder="Total beds" value={hostelForm.total_beds}
                      onChange={(e) => setHostelForm({ ...hostelForm, total_beds: parseInt(e.target.value) || 0 })} />
                    <input className={FIELD} placeholder="Warden name" value={hostelForm.warden_name}
                      onChange={(e) => setHostelForm({ ...hostelForm, warden_name: e.target.value })} />
                    <div className="flex items-end">
                      <Button data-native-tap className="rounded font-mono text-xs uppercase w-full"
                        onClick={() => post('/api/v1/hostels', hostelForm, () => { setShowHostel(false); loadHostels(); })}>
                        Create
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hostels.map((h) => (
              <Card key={h.id} className="shadow-none border-border rounded bg-background">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-bold text-foreground">{h.name}</h3>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">{h.gender}</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden border border-border mb-2">
                    <div className="h-full bg-accent" style={{ width: `${h.occupancy_pct ?? 0}%` }} />
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {h.occupied}/{h.total_beds} beds · {h.available} free · {h.mess_count} on mess
                  </p>
                  {h.warden_name && (
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">Warden: {h.warden_name}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-widest">Allocate a bed</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <select className={FIELD} value={allocForm.hostel_id} onChange={(e) => setAllocForm({ ...allocForm, hostel_id: e.target.value })}>
                <option value="">-- Hostel --</option>
                {hostels.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.available} free)</option>)}
              </select>
              <select className={FIELD} value={allocForm.trainee_id} onChange={(e) => setAllocForm({ ...allocForm, trainee_id: e.target.value })}>
                <option value="">-- Trainee --</option>
                {trainees.map((t) => <option key={t.id} value={t.id}>{t.profiles?.full_name || t.location || t.id.slice(0, 8)}</option>)}
              </select>
              <input className={FIELD} placeholder="Room no." value={allocForm.room_number}
                onChange={(e) => setAllocForm({ ...allocForm, room_number: e.target.value })} />
              <div className="flex gap-2">
                <select className={`${FIELD} flex-1`} value={allocForm.dietary_preference}
                  onChange={(e) => setAllocForm({ ...allocForm, dietary_preference: e.target.value })}>
                  {['VEG', 'NON_VEG', 'JAIN', 'VEGAN'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <Button data-native-tap className="rounded font-mono text-[10px] uppercase"
                  onClick={() => post('/api/v1/hostels/allocations', { ...allocForm, mess_opted: true }, loadHostels)}>
                  Allocate
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {allocations.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 border border-border rounded px-3 py-2.5 bg-background">
                <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                  {a.trainees?.profiles?.full_name || 'Trainee'}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {a.hostels?.name}{a.room_number ? ` · Room ${a.room_number}` : ''} · {a.dietary_preference}
                </span>
                <Button variant="outline" data-native-tap className="rounded font-mono text-[10px] uppercase"
                  onClick={() => post('/api/v1/hostels/allocations', { allocation_id: a.id }, loadHostels, 'PATCH')}>
                  Check out
                </Button>
              </div>
            ))}
            {!allocations.length && (
              <div className="text-center py-10 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                No active allocations.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const FIELD = 'px-3 py-2 border border-border rounded bg-background text-sm font-mono';

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between text-muted-foreground mb-5">
          <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
          <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">{icon}</div>
        </div>
        <div className="text-3xl font-bold text-foreground tracking-tighter tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
