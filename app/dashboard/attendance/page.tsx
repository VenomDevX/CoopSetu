'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Users, Clock, CheckCircle2, Search, Plus, XCircle, Camera, ScanLine, RefreshCw, UserCheck } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { QrScanner } from '@/components/attendance/qr-scanner';
import { FaceCapture } from '@/components/attendance/face-capture';
import { useIsNative } from '@/components/native/native-provider';

interface Session {
  id: string;
  batch_id: string;
  date: string;
  session_type: string;
  session_slot: string;
  qr_token?: string;
  qr_expires_at?: string;
  is_active: boolean;
  attendance_records?: { count: number }[];
}

interface AttendanceRecord {
  id: string;
  trainee_id: string;
  method: string;
  status: string;
  marked_at: string;
}

interface Stats { totalSessions: number; totalRecords: number; present: number; averageAttendance: number; }

export default function AttendancePage() {
  // The native app bar already names this screen, so the page's own <h1> is
  // a duplicate: two h1s on one screen, the second repeating what the sticky
  // bar above it already says. Dropping it in the app reclaims 40px (measured
  // on a Pixel 7) and leaves exactly one h1 on the page.
  const isNative = useIsNative();
  const t = useTranslations('Attendance');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, totalRecords: 0, present: 0, averageAttendance: 0 });
  const [batchId, setBatchId] = useState('');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [liveRecords, setLiveRecords] = useState<AttendanceRecord[]>([]);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [captureMode, setCaptureMode] = useState<'qr' | 'face' | null>(null);
  const [sessionForm, setSessionForm] = useState({ batch_id: '', session_type: 'LECTURE', session_slot: 'MORNING' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    if (!batchId) return;
    fetch(`/api/v1/attendance?batch_id=${batchId}`).then(r => r.json()).then(j => {
      if (j?.data) { setSessions(j.data.sessions || []); setStats(s => j.data.stats || s); }
    });
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  // Live polling
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeSession) { return; }
    const poll = () => {
      fetch(`/api/v1/attendance?session_id=${activeSession.id}&records=true`).then(r => r.json()).then(j => {
        if (j?.data?.records) setLiveRecords(j.data.records);
      }).catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeSession]);

  const createSession = async () => {
    const res = await fetch('/api/v1/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_session', ...sessionForm }) });
    const j = await res.json();
    if (j?.data) { setActiveSession(j.data); setLiveRecords([]); }
    setShowCreateSession(false);
    if (sessionForm.batch_id) setBatchId(sessionForm.batch_id);
    load();
  };

  const closeSession = async (sessionId: string) => {
    await fetch('/api/v1/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close_session', session_id: sessionId }) });
    setActiveSession(null);
    setLiveRecords([]);
    load();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-green-500 animate-pulse rounded" />
            Training_ERP // Digital Attendance
          </div>
          {!isNative && (
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">{t('heading')}</h1>
          )}
          <p className="text-sm text-muted-foreground mt-2 font-mono">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreateSession(!showCreateSession)}>
            <Plus className="w-4 h-4 mr-2" /> {t('newSession')}
          </Button>
        </div>
      </motion.div>

      {/* ===== ACTIVE SESSION FEED ===== */}
      <AnimatePresence>
        {activeSession && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <Card className="shadow-none border-2 border-green-500/40 rounded bg-background overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr]">
                  <div className="p-8 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-border bg-surface-hover/30">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="font-mono text-xs uppercase tracking-widest text-green-500">{t('liveSession')}</span>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                      <div>
                        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Type</div>
                        <div className="font-mono text-sm">{activeSession.session_type}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Slot</div>
                        <div className="font-mono text-sm">{activeSession.session_slot}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Date</div>
                        <div className="font-mono text-sm">{new Date(activeSession.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    
                    {/* Capture without hardware. Both libraries have shipped in
                        the repo unused since the offline work; an institute with
                        no terminal can now take attendance from a phone. */}
                    <div className="mb-6 space-y-3">
                      <div className="flex gap-2">
                        {(['qr', 'face'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setCaptureMode(captureMode === m ? null : m)}
                            data-native-tap
                            className={`flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded transition-colors ${
                              captureMode === m
                                ? 'bg-foreground text-background border-foreground'
                                : 'border-border text-muted-foreground hover:border-foreground'
                            }`}
                          >
                            {m === 'qr' ? 'Scan QR' : 'Face check-in'}
                          </button>
                        ))}
                      </div>

                      {captureMode === 'qr' && (
                        <QrScanner onScanned={(r) => { if (r.ok) load(); }} />
                      )}
                      {captureMode === 'face' && (
                        <FaceCapture
                          mode="verify"
                          sessionId={activeSession.id}
                          onDone={(r) => { if (r.verified) load(); }}
                        />
                      )}
                    </div>

                    <Button variant="outline" className="w-full rounded font-mono text-xs uppercase text-red-500 border-red-500/40 hover:bg-red-500/10" onClick={() => closeSession(activeSession.id)}>
                      <XCircle className="w-4 h-4 mr-2" /> {t('endSession')}
                    </Button>
                  </div>
                  {/* Live Feed */}
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-mono text-sm uppercase tracking-widest text-foreground">{t('hardwareCheckins')}</h3>
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" style={{ animationDuration: '3s' }} />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{t('autoRefresh')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                      <div className="text-5xl font-bold text-foreground tracking-tighter">
                        {liveRecords.length}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono uppercase">
                        {t('traineesCheckedIn')}
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                      {liveRecords.length === 0 && (
                        <div className="text-center py-12 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex flex-col items-center gap-3">
                          <ScanLine className="w-8 h-8 text-muted-foreground/50" />
                          {t('waitingForScan')}
                        </div>
                      )}
                      <AnimatePresence>
                        {liveRecords.map((rec) => (
                          <motion.div key={rec.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 p-3 border border-border rounded hover:bg-surface-hover transition-colors">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${rec.method === 'QR' ? 'bg-green-500/10 text-green-500' : rec.method === 'FACE' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                              {rec.method === 'QR' ? <QrCode className="w-4 h-4" /> : rec.method === 'FACE' ? <Camera className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-mono text-foreground truncate">{rec.trainee_id.slice(0, 8)}...</div>
                              <div className="text-[10px] text-muted-foreground font-mono uppercase">{rec.method} • {new Date(rec.marked_at).toLocaleTimeString()}</div>
                            </div>
                            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${rec.status === 'PRESENT' ? 'border-green-500/40 text-green-500' : 'border-border text-muted-foreground'}`}>{rec.status}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Session */}
      {showCreateSession && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">{t('newAttendanceSession')}</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Batch ID" value={sessionForm.batch_id} onChange={e => setSessionForm({ ...sessionForm, batch_id: e.target.value })} />
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={sessionForm.session_type} onChange={e => setSessionForm({ ...sessionForm, session_type: e.target.value })}>
                <option value="LECTURE">Lecture</option><option value="LAB">Lab</option><option value="WORKSHOP">Workshop</option><option value="EXAM">Exam</option>
              </select>
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={sessionForm.session_slot} onChange={e => setSessionForm({ ...sessionForm, session_slot: e.target.value })}>
                <option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option><option value="EVENING">Evening</option><option value="FULL_DAY">Full Day</option>
              </select>
              <div className="md:col-span-3"><Button onClick={createSession} className="rounded font-mono text-xs uppercase w-full sm:w-auto">{t('startSession')}</Button></div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Batch Input */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder={t('searchPlaceholder')} value={batchId} onChange={e => setBatchId(e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      {batchId && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { label: t('totalSessions'), value: stats.totalSessions, icon: <Clock className="w-5 h-5" /> },
            { label: t('totalRecords'), value: stats.totalRecords || 0, icon: <Users className="w-5 h-5" /> },
            { label: t('present'), value: stats.present || 0, icon: <CheckCircle2 className="w-5 h-5" /> },
            { label: t('avgAttendance'), value: `${stats.averageAttendance}%`, icon: <QrCode className="w-5 h-5" /> },
          ].map((s, i) => (
            <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
              <CardContent className="p-6"><div className="flex items-center justify-between text-muted-foreground mb-4"><span className="font-mono text-[10px] uppercase tracking-widest">{s.label}</span><div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">{s.icon}</div></div><div className="text-3xl font-bold text-foreground tracking-tighter">{s.value}</div></CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Session List */}
      {batchId && sessions.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_100px_80px] gap-4 px-4 py-3 bg-surface-hover font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border hidden md:grid">
            <span>{t('colDate')}</span><span>{t('colType')}</span><span>{t('colSlot')}</span><span>{t('colRecords')}</span><span>{t('colActive')}</span>
          </div>
          {sessions.map(s => (
            <div key={s.id} className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px_100px_80px] gap-2 md:gap-4 px-4 py-3 border-b border-border hover:bg-surface-hover transition-colors items-center cursor-pointer" onClick={() => { if (s.is_active) { setActiveSession(s); setLiveRecords([]); } }}>
              <span className="text-sm font-mono text-foreground">{new Date(s.date).toLocaleDateString()}</span>
              <span className="text-xs font-mono uppercase text-muted-foreground">{s.session_type}</span>
              <span className="text-xs font-mono uppercase text-muted-foreground">{s.session_slot}</span>
              <span className="text-xs font-mono text-foreground">{(s.attendance_records as any)?.[0]?.count || 0}</span>
              <span className={`text-[10px] font-mono uppercase ${s.is_active ? 'text-green-500' : 'text-muted-foreground'}`}>{s.is_active ? t('live') : t('closed')}</span>
            </div>
          ))}
        </div>
      )}
      {batchId && sessions.length === 0 && (
        <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">{t('noSessions')}</div>
      )}
    </div>
  );
}
