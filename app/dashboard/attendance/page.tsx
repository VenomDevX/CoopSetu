'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Users, Clock, CheckCircle2, Search, Plus, XCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

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

interface Stats { totalSessions: number; totalRecords: number; present: number; averageAttendance: number; }

export default function AttendancePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, totalRecords: 0, present: 0, averageAttendance: 0 });
  const [batchId, setBatchId] = useState('');
  const [activeQR, setActiveQR] = useState<string | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({ batch_id: '', session_type: 'LECTURE', session_slot: 'MORNING' });

  const load = useCallback(() => {
    if (!batchId) return;
    fetch(`/api/v1/attendance?batch_id=${batchId}`).then(r => r.json()).then(j => {
      if (j?.data) { setSessions(j.data.sessions || []); setStats(j.data.stats || stats); }
    });
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  const createSession = async () => {
    const res = await fetch('/api/v1/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_session', ...sessionForm }),
    });
    const j = await res.json();
    if (j?.data?.qr_token) setActiveQR(j.data.qr_token);
    setShowCreateSession(false);
    if (sessionForm.batch_id) { setBatchId(sessionForm.batch_id); }
    load();
  };

  const closeSession = async (sessionId: string) => {
    await fetch('/api/v1/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close_session', session_id: sessionId }),
    });
    setActiveQR(null);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Training_ERP // Digital Attendance
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Attendance System</h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono">QR-based digital attendance tracking</p>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreateSession(!showCreateSession)}>
          <Plus className="w-4 h-4 mr-2" /> New Session
        </Button>
      </motion.div>

      {/* Active QR Display */}
      {activeQR && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="shadow-none border-2 border-green-500/40 rounded bg-background">
            <CardContent className="p-8 text-center">
              <div className="mb-4">
                <QrCode className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-bold text-foreground uppercase tracking-widest">Active QR Session</h3>
                <p className="text-sm text-muted-foreground mt-2 font-mono">Share this token with trainees to mark attendance</p>
              </div>
              <div className="bg-surface-hover border border-border rounded p-6 my-6 inline-block">
                <code className="text-2xl font-bold text-foreground tracking-wider">{activeQR}</code>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => navigator.clipboard.writeText(activeQR)}>
                  Copy Token
                </Button>
                <Button variant="outline" className="rounded font-mono text-xs uppercase text-red-500 border-red-500/40" onClick={() => {
                  const session = sessions.find(s => s.qr_token === activeQR);
                  if (session) closeSession(session.id);
                }}>
                  <XCircle className="w-4 h-4 mr-2" /> Close Session
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create Session Form */}
      {showCreateSession && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">New Attendance Session</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Batch ID" value={sessionForm.batch_id} onChange={e => setSessionForm({ ...sessionForm, batch_id: e.target.value })} />
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={sessionForm.session_type} onChange={e => setSessionForm({ ...sessionForm, session_type: e.target.value })}>
                <option value="LECTURE">Lecture</option>
                <option value="LAB">Lab</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="EXAM">Exam</option>
              </select>
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={sessionForm.session_slot} onChange={e => setSessionForm({ ...sessionForm, session_slot: e.target.value })}>
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
                <option value="EVENING">Evening</option>
                <option value="FULL_DAY">Full Day</option>
              </select>
              <div className="md:col-span-3">
                <Button onClick={createSession} className="rounded font-mono text-xs uppercase">Generate QR & Start Session</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Batch ID Input */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Enter Batch ID to view attendance..." value={batchId} onChange={e => setBatchId(e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      {batchId && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { label: 'Total Sessions', value: stats.totalSessions, icon: <Clock className="w-5 h-5" /> },
            { label: 'Total Records', value: stats.totalRecords || 0, icon: <Users className="w-5 h-5" /> },
            { label: 'Present', value: stats.present || 0, icon: <CheckCircle2 className="w-5 h-5" /> },
            { label: 'Avg Attendance', value: `${stats.averageAttendance}%`, icon: <QrCode className="w-5 h-5" /> },
          ].map((s, i) => (
            <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-muted-foreground mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest">{s.label}</span>
                  <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">{s.icon}</div>
                </div>
                <div className="text-3xl font-bold text-foreground tracking-tighter">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Session List */}
      {batchId && sessions.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_100px_80px] gap-4 px-4 py-3 bg-surface-hover font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border hidden md:grid">
            <span>Date</span><span>Type</span><span>Slot</span><span>Records</span><span>Active</span>
          </div>
          {sessions.map(s => (
            <div key={s.id} className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px_100px_80px] gap-2 md:gap-4 px-4 py-3 border-b border-border hover:bg-surface-hover transition-colors items-center">
              <span className="text-sm font-mono text-foreground">{new Date(s.date).toLocaleDateString()}</span>
              <span className="text-xs font-mono uppercase text-muted-foreground">{s.session_type}</span>
              <span className="text-xs font-mono uppercase text-muted-foreground">{s.session_slot}</span>
              <span className="text-xs font-mono text-foreground">{(s.attendance_records as any)?.[0]?.count || 0}</span>
              <span className={`text-[10px] font-mono uppercase ${s.is_active ? 'text-green-500' : 'text-muted-foreground'}`}>{s.is_active ? 'LIVE' : 'CLOSED'}</span>
            </div>
          ))}
        </div>
      )}

      {batchId && sessions.length === 0 && (
        <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          No attendance sessions found for this batch.
        </div>
      )}
    </div>
  );
}
