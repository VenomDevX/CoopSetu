'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Plus, Trash2, Edit, RefreshCw, Wifi, WifiOff, Copy, Check } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from 'next-intl';

interface Device {
  id: string;
  label: string;
  device_name: string | null;
  location: string | null;
  status: string;
  token_hint: string;
  institution: string | null;
  institution_id: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
  is_online: boolean;
}

export default function DevicesPage() {
  const t = useTranslations('Nav');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ label: '', device_name: '', location: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', device_name: '', location: '' });

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/devices');
      const data = await res.json();
      setDevices(data.devices || []);
    } catch (e) {
      console.error('Failed to fetch devices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleCreate = async () => {
    if (!form.label.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.token) {
        setNewToken(data.token);
        setShowCreate(false);
        setForm({ label: '', device_name: '', location: '' });
        fetchDevices();
      }
    } catch (e) {
      console.error('Failed to create device:', e);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this device token? This cannot be undone.')) return;
    try {
      await fetch(`/api/v1/devices/${id}`, { method: 'DELETE' });
      fetchDevices();
    } catch (e) {
      console.error('Failed to revoke device:', e);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await fetch(`/api/v1/devices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      fetchDevices();
    } catch (e) {
      console.error('Failed to update device:', e);
    }
  };

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const relativeTime = (iso: string | null) => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const activeDevices = devices.filter(d => d.status !== 'REVOKED');
  const onlineCount = devices.filter(d => d.is_online).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('devices')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage attendance terminal devices and their bearer tokens.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDevices}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Issue Token
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{activeDevices.length}</div>
            <div className="text-xs text-muted-foreground">Active Devices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-500" />
              <div className="text-2xl font-bold">{onlineCount}</div>
            </div>
            <div className="text-xs text-muted-foreground">Online Now</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-red-500" />
              <div className="text-2xl font-bold">{activeDevices.length - onlineCount}</div>
            </div>
            <div className="text-xs text-muted-foreground">Offline</div>
          </CardContent>
        </Card>
      </div>

      {/* New token reveal */}
      <AnimatePresence>
        {newToken && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-yellow-600">⚠️ Save this token now — it will not be shown again.</p>
                    <code className="mt-2 block text-sm bg-black/20 p-2 rounded font-mono break-all">{newToken}</code>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyToken}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewToken(null)}>
                  I&apos;ve saved it — dismiss
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card>
              <CardHeader><CardTitle>Issue New Device Token</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <input className="w-full p-2 border rounded bg-transparent" placeholder="Label (required, e.g. 'Main Entrance')"
                  value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
                <input className="w-full p-2 border rounded bg-transparent" placeholder="Device Name (optional)"
                  value={form.device_name} onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))} />
                <input className="w-full p-2 border rounded bg-transparent" placeholder="Location (optional)"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={creating || !form.label.trim()}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Device list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading devices...</div>
        ) : devices.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Cpu className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No devices registered yet.</p>
              <Button className="mt-3" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1" /> Issue First Token
              </Button>
            </CardContent>
          </Card>
        ) : (
          devices.map(device => (
            <motion.div key={device.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className={device.status === 'REVOKED' ? 'opacity-50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${device.is_online ? 'bg-green-500' : device.status === 'REVOKED' ? 'bg-red-500' : 'bg-gray-400'}`} />
                      <div>
                        {editingId === device.id ? (
                          <div className="flex gap-2">
                            <input className="p-1 border rounded text-sm bg-transparent" value={editForm.label}
                              onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} />
                            <input className="p-1 border rounded text-sm bg-transparent" placeholder="Name" value={editForm.device_name}
                              onChange={e => setEditForm(f => ({ ...f, device_name: e.target.value }))} />
                            <input className="p-1 border rounded text-sm bg-transparent" placeholder="Location" value={editForm.location}
                              onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                            <Button size="sm" onClick={() => handleUpdate(device.id)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium">{device.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {[device.device_name, device.location, device.institution].filter(Boolean).join(' · ') || 'No details'}
                              {' · '}Token: ···{device.token_hint}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{device.is_online ? '🟢 Online' : `Last seen: ${relativeTime(device.last_seen_at)}`}</span>
                      {device.status !== 'REVOKED' && editingId !== device.id && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingId(device.id);
                            setEditForm({ label: device.label, device_name: device.device_name || '', location: device.location || '' });
                          }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleRevoke(device.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {device.status === 'REVOKED' && (
                        <span className="text-red-500 font-medium">Revoked</span>
                      )}
                    </div>
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
