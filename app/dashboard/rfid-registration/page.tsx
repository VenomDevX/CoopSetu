'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Search, UserCheck, XCircle, RefreshCw, AlertTriangle, Check, Radio, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from 'next-intl';
import { useCaptureRealtime } from '@/hooks/use-attendance-realtime';

interface UserResult {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  institution_id: string | null;
  institution_name: string | null;
  has_rfid: boolean;
  rfid_uid: string | null;
}

interface CaptureEntry {
  id: string;
  rfidUid: string | null;
  status: string;
  deviceId: string;
  deviceName: string;
  createdAt: string;
  expiresAt: string;
}

interface AttendanceDevice {
  id: string;
  label: string;
  device_name: string | null;
}

export default function RfidRegistrationPage() {
  const t = useTranslations('Nav');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [rfidUid, setRfidUid] = useState('');
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [revoking, setRevoking] = useState(false);
  // Tap-to-capture
  const [captureMode, setCaptureMode] = useState(false);
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const searchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (role) params.set('role', role);
      params.set('limit', '20');
      params.set('offset', String(offset));
      const res = await fetch(`/api/v1/users/search?${params.toString()}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  }, [query, role, offset]);

  // Load list on mount — no longer gated on query.length >= 2
  // Debounced search on query/role change
  useEffect(() => {
    const timer = setTimeout(() => { searchUsers(); }, 300);
    return () => clearTimeout(timer);
  }, [searchUsers]);

  // Tap-to-capture: poll for captured UIDs
  const fetchCaptures = useCallback(async () => {
    if (!captureMode) return;
    try {
      const res = await fetch('/api/v1/rfid/capture');
      const json = await res.json();
      if (json?.data?.captures) setCaptures(json.data.captures);
    } catch (e) {
      console.error('Capture fetch failed:', e);
    }
  }, [captureMode]);

  useEffect(() => {
    if (!captureMode) return;
    const timer = setTimeout(fetchCaptures, 0);
    return () => clearTimeout(timer);
  }, [captureMode, fetchCaptures]);
  useCaptureRealtime(fetchCaptures);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/devices');
        const json = await response.json();
        const available = (json.devices || []).filter((device: { status?: string }) => device.status === 'ACTIVE');
        setDevices(available);
        setSelectedDeviceId((current) => current || available[0]?.id || '');
      } catch (error) {
        console.error('Device list failed:', error);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleCapture = async () => {
    if (captureMode) {
      setCaptureMode(false);
      return;
    }
    if (!selectedDeviceId) return;
    setCaptures([]);
    const response = await fetch('/api/v1/rfid/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: selectedDeviceId }),
    });
    if (!response.ok) {
      const json = await response.json();
      setResult({ ok: false, message: json?.error?.message || 'Could not start card capture' });
      return;
    }
    setCaptureMode(true);
  };

  const handleRegister = async (uid?: string, captureId?: string) => {
    const cardUid = uid || rfidUid.trim();
    if (!selectedUser || !cardUid) return;
    setRegistering(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/rfid/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfid_uid: cardUid.toUpperCase(),
          member_id: selectedUser.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (captureId) {
          await fetch('/api/v1/rfid/capture', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: captureId }),
          });
        }
        setResult({ ok: true, message: data.message || 'RFID card registered successfully' });
        setRfidUid('');
        setCaptureMode(false);
        searchUsers();
      } else {
        setResult({ ok: false, message: data.error || 'Registration failed' });
      }
    } catch (e) {
      setResult({ ok: false, message: 'Network error' });
    } finally {
      setRegistering(false);
    }
  };

  const handleRevoke = async (uid: string) => {
    if (!confirm('Revoke this RFID card? The user will need a new card registered.')) return;
    setRevoking(true);
    try {
      const res = await fetch('/api/v1/rfid/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', rfid_uid: uid }),
      });
      if (res.ok) {
        setResult({ ok: true, message: 'RFID card revoked' });
        searchUsers();
      }
    } catch (e) {
      console.error('Revoke failed:', e);
    } finally {
      setRevoking(false);
    }
  };

  const showInstitutionColumn = new Set(users.map(u => u.institution_id).filter(Boolean)).size > 1;

  const roles = [
    { value: '', label: 'All Roles' },
    { value: 'TRAINEE', label: 'Trainee' },
    { value: 'TRAINER', label: 'Trainer' },
    { value: 'EMPLOYEE', label: 'Employee' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6"
      >
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-purple-500 rounded" />
            Training_ERP // RFID Card Management
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">{t('rfidRegistration')}</h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono">Link RFID cards to members for kiosk-based attendance</p>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => searchUsers()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </motion.div>

      {/* Result banner */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className={`shadow-none rounded ${result.ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.ok ? <Check className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <span className="text-sm font-mono">{result.message}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + filter controls */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono"
              placeholder="Filter by name..."
              value={query}
              onChange={e => { setQuery(e.target.value); setOffset(0); }}
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Role</label>
          <select
            className="px-3 py-2 border border-border rounded bg-background text-sm font-mono"
            value={role}
            onChange={e => { setRole(e.target.value); setOffset(0); }}
          >
            {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* Registration form (when a user is selected) */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <Card className="shadow-none border-2 border-purple-500/40 rounded bg-background">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-purple-500/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="font-mono text-sm text-foreground font-medium">{selectedUser.name}</div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {selectedUser.role}
                        {selectedUser.has_rfid && (
                          <span className="ml-2">
                            • RFID: <code className="text-purple-500">{selectedUser.rfid_uid}</code>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>

                {selectedUser.has_rfid && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded font-mono text-xs uppercase text-red-500 border-red-500/40 hover:bg-red-500/10" onClick={() => selectedUser.rfid_uid && handleRevoke(selectedUser.rfid_uid)} disabled={revoking}>
                      Revoke Current Card
                    </Button>
                  </div>
                )}

                {/* Manual UID entry */}
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 border border-border rounded bg-background text-sm font-mono uppercase"
                    placeholder="Enter RFID UID (hex, e.g. 04A3B2C1)"
                    value={rfidUid}
                    onChange={e => setRfidUid(e.target.value)}
                  />
                  <Button className="rounded font-mono text-xs uppercase" onClick={() => handleRegister()} disabled={registering || !rfidUid.trim()}>
                    {registering ? 'Registering...' : selectedUser.has_rfid ? 'Replace' : 'Register'}
                  </Button>
                </div>

                {/* Tap-to-capture toggle */}
                <div className="border-t border-border pt-4">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Terminal</label>
                  <select
                    className="w-full px-3 py-2 mb-2 border border-border rounded bg-background text-sm font-mono"
                    value={selectedDeviceId}
                    onChange={event => setSelectedDeviceId(event.target.value)}
                    disabled={captureMode}
                  >
                    <option value="">Select terminal...</option>
                    {devices.map(device => (
                      <option key={device.id} value={device.id}>{device.device_name || device.label}</option>
                    ))}
                  </select>
                  <Button
                    variant={captureMode ? 'default' : 'outline'}
                    className="rounded font-mono text-xs uppercase w-full"
                    onClick={toggleCapture}
                    disabled={!captureMode && !selectedDeviceId}
                  >
                    <Radio className="w-4 h-4 mr-2" />
                    {captureMode ? 'Listening for card tap...' : 'Tap to Capture from Terminal'}
                  </Button>

                  {captureMode && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Scan a card on any terminal — it will appear here automatically
                      </p>
                      {captures.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground font-mono text-xs">
                          <Radio className="w-6 h-6 mx-auto mb-2 animate-pulse text-purple-500" />
                          Waiting for card tap...
                        </div>
                      ) : (
                        captures.filter(c => c.status === 'CAPTURED' && c.rfidUid).map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 border border-border rounded hover:bg-surface-hover transition-colors">
                            <div>
                              <div className="font-mono text-sm text-foreground">{c.rfidUid}</div>
                              <div className="text-[10px] font-mono text-muted-foreground uppercase">
                                {c.deviceName} • {new Date(c.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="rounded font-mono text-xs uppercase"
                              onClick={() => handleRegister(c.rfidUid || undefined, c.id)}
                              disabled={registering}
                            >
                              Assign
                            </Button>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-xs uppercase">Loading members...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-xs uppercase">
          {query || role ? 'No members found. Adjust your search.' : 'No members in this organization.'}
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_120px] gap-4 px-4 py-3 bg-surface-hover font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border hidden md:grid">
            <span>Member</span><span>Role</span><span>RFID Status</span>
          </div>
          {users.map(user => (
            <div
              key={user.id}
              className={`grid grid-cols-1 md:grid-cols-[1fr_100px_120px] gap-2 md:gap-4 px-4 py-3 border-b border-border hover:bg-surface-hover transition-colors items-center cursor-pointer ${selectedUser?.id === user.id ? 'bg-purple-500/5 border-purple-500/30' : ''}`}
              onClick={() => setSelectedUser(user)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-mono text-foreground">{user.name}</div>
                  {showInstitutionColumn && user.institution_name && (
                    <div className="text-[10px] font-mono text-muted-foreground">{user.institution_name}</div>
                  )}
                </div>
              </div>
              <span className="text-xs font-mono uppercase text-muted-foreground">{user.role}</span>
              <div>
                {user.has_rfid ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 border rounded border-green-500/40 text-green-500">
                    <CreditCard className="w-3 h-3" /> {user.rfid_uid}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">No card</span>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-hover border-t border-border">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              {total === 0 ? '0' : `${offset + 1}-${Math.min(offset + users.length, total)}`} of {total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" aria-label="Previous page" title="Previous page"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(value => Math.max(0, value - 20))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" aria-label="Next page" title="Next page"
                disabled={offset + users.length >= total || loading}
                onClick={() => setOffset(value => value + 20)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
