'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Search, UserCheck, XCircle, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from 'next-intl';

interface UserResult {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  institution_id: string | null;
  has_rfid: boolean;
  rfid_uid: string | null;
}

export default function RfidRegistrationPage() {
  const t = useTranslations('Nav');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [rfidUid, setRfidUid] = useState('');
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const searchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (role) params.set('role', role);
      const res = await fetch(`/api/v1/users/search?${params.toString()}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  }, [query, role]);

  useEffect(() => {
    const timer = setTimeout(() => { if (query.length >= 2 || role) searchUsers(); }, 300);
    return () => clearTimeout(timer);
  }, [query, role, searchUsers]);

  const handleRegister = async () => {
    if (!selectedUser || !rfidUid.trim()) return;
    setRegistering(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/rfid/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfid_uid: rfidUid.trim().toUpperCase(),
          member_id: selectedUser.id,
          organization_id: '', // will be inferred from session
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: data.message || 'RFID card registered successfully' });
        setRfidUid('');
        searchUsers(); // Refresh to show updated RFID status
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

  const roles = [
    { value: '', label: 'All Roles' },
    { value: 'TRAINEE', label: 'Trainee' },
    { value: 'TRAINER', label: 'Trainer' },
    { value: 'EMPLOYEE', label: 'Employee' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('rfidRegistration')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Link RFID cards to members for kiosk-based attendance.
        </p>
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className={result.ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.ok ? <Check className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <span className="text-sm">{result.message}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search controls */}
      <Card>
        <CardHeader><CardTitle>Search Members</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-10 p-2 border rounded bg-transparent"
                placeholder="Search by name..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <select
              className="p-2 border rounded bg-transparent"
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={searchUsers}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Registration form (when a user is selected) */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Register RFID for {selectedUser.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Role: <span className="font-medium text-foreground">{selectedUser.role}</span>
                  {selectedUser.has_rfid && (
                    <span className="ml-3">
                      Current RFID: <code className="bg-muted px-1 rounded">{selectedUser.rfid_uid}</code>
                      <Button variant="ghost" size="sm" className="ml-1 text-red-500 h-6" onClick={() => selectedUser.rfid_uid && handleRevoke(selectedUser.rfid_uid)} disabled={revoking}>
                        Revoke
                      </Button>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 p-2 border rounded bg-transparent font-mono uppercase"
                    placeholder="Enter RFID UID (hex, e.g. 04A3B2C1)"
                    value={rfidUid}
                    onChange={e => setRfidUid(e.target.value)}
                  />
                  <Button onClick={handleRegister} disabled={registering || !rfidUid.trim()}>
                    {registering ? 'Registering...' : selectedUser.has_rfid ? 'Replace Card' : 'Register Card'}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedUser(null)}>Cancel</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: On the physical terminal, use Admin Mode to scan the card directly instead of typing the UID.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Searching...</div>
        ) : users.length === 0 && (query || role) ? (
          <div className="text-center py-8 text-muted-foreground">No members found. Adjust your search.</div>
        ) : (
          users.map(user => (
            <motion.div key={user.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card
                className={`cursor-pointer transition-colors hover:border-primary/40 ${selectedUser?.id === user.id ? 'border-primary ring-1 ring-primary/20' : ''}`}
                onClick={() => setSelectedUser(user)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.has_rfid ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">
                        <CreditCard className="w-3 h-3" /> {user.rfid_uid}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No RFID</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
