'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, CheckCircle2, XCircle , Settings} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePermission, useCurrentMembership } from '@/lib/permissions/context';

interface Status {
  checks: Record<string, string>;
  env: { supabaseUrl?: string; appUrl?: string; aiMode?: string; nodeEnv?: string };
  user: { id: string; email?: string };
  organization: { id: string; name?: string; slug?: string };
  member: { id: string; roles: string[]; permissions: string[] };
  seed: { members: number; teams: number; projects: number; tasks: number };
}

function Dot({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : <XCircle className="w-4 h-4 text-destructive" />;
}

export default function DeveloperStatusPage() {
  const { isAdmin } = usePermission();
  const membership = useCurrentMembership();
  const [status, setStatus] = useState<Status | null>(null);
  const [realtime, setRealtime] = useState<'checking' | 'connected' | 'failed'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/v1/dev/status')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setError(j.error?.message ?? 'Failed to load status.'); return; }
        setStatus(j.data);
      })
      .catch(() => setError('Failed to load status.'));

    // client-side realtime connectivity ping
    const supabase = createClient();
    const ch = supabase.channel(`devstatus:${Math.random().toString(36).slice(2)}`)
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setRealtime('connected');
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setRealtime('failed');
      });
    const timer = setTimeout(() => setRealtime((p) => (p === 'checking' ? 'failed' : p)), 6000);
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="py-16 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Developer status is restricted to organization owners/admins.
      </div>
    );
  }

  const connections = [
    { label: 'Auth', ok: status?.checks.auth === 'connected' },
    { label: 'Database', ok: status?.checks.database === 'connected' },
    { label: 'Storage', ok: status?.checks.storage === 'connected' },
    { label: 'Realtime', ok: realtime === 'connected' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <span>Settings</span><ChevronRight className="w-3 h-3" /><span className="text-foreground">Developer Status</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
          <Settings className="w-8 h-8" />Developer Status
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
          Local backend connection + access diagnostics
        </p>
      </div>

      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {connections.map((c) => (
          <div key={c.label} className="border border-border bg-surface p-4 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest">{c.label}</span>
            <Dot ok={c.ok} />
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-border bg-background p-4 space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-2">Session</h3>
          <Row k="User" v={status?.user.email ?? '—'} />
          <Row k="User ID" v={status?.user.id ?? '—'} mono />
          <Row k="Organization" v={status?.organization.name ?? membership.organizationName} />
          <Row k="Org ID" v={status?.organization.id ?? '—'} mono />
          <Row k="Member ID" v={status?.member.id ?? '—'} mono />
        </div>
        <div className="border border-border bg-background p-4 space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-2">Environment</h3>
          <Row k="Supabase URL" v={status?.env.supabaseUrl ?? '—'} mono />
          <Row k="App URL" v={status?.env.appUrl ?? '—'} mono />
          <Row k="AI Mode" v={status?.env.aiMode ?? '—'} />
          <Row k="Node Env" v={status?.env.nodeEnv ?? '—'} />
        </div>
      </div>

      <div className="border border-border bg-background p-4">
        <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-2">Roles</h3>
        <div className="flex flex-wrap gap-2">
          {(status?.member.roles ?? membership.roles).map((r) => (
            <span key={r} className="font-mono text-[10px] uppercase tracking-widest border border-border px-2 py-1">{r}</span>
          ))}
        </div>
      </div>

      <div className="border border-border bg-background p-4">
        <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-2">
          Effective Permissions ({status?.member.permissions.length ?? 0})
        </h3>
        <div className="flex flex-wrap gap-1">
          {(status?.member.permissions ?? []).map((p) => (
            <span key={p} className="font-mono text-[10px] border border-border px-1.5 py-0.5 text-muted-foreground">{p}</span>
          ))}
        </div>
      </div>

      <div className="border border-border bg-background p-4">
        <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-2">Seed Data (this org)</h3>
        <div className="grid grid-cols-4 gap-3">
          {status && [
            { k: 'Members', v: status.seed.members },
            { k: 'Teams', v: status.seed.teams },
            { k: 'Projects', v: status.seed.projects },
            { k: 'Tasks', v: status.seed.tasks },
          ].map((s) => (
            <div key={s.k} className="text-center border border-border p-3">
              <div className="text-2xl font-bold">{s.v}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.k}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</span>
      <span className={`truncate ${mono ? 'font-mono text-[10px]' : ''}`}>{v}</span>
    </div>
  );
}
