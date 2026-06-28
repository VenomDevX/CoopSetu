'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Plus, Save , Settings} from 'lucide-react';
import { usePermission } from '@/lib/permissions/context';

interface Role {
  id: string; code: string; name: string; description: string | null;
  is_system: boolean; is_custom: boolean; permissions: string[];
}
interface Permission { code: string; description: string | null }

export default function RolesSettingsPage() {
  const { has } = usePermission();
  const canManage = has('member:manage');
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState({ code: '', name: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/v1/roles').then((r) => r.json()).then((j) => setRoles(Array.isArray(j?.data) ? j.data : []));
    fetch('/api/v1/permissions').then((r) => r.json()).then((j) => setPerms(Array.isArray(j?.data) ? j.data : []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = roles.find((r) => r.id === selected) ?? null;

  function selectRole(r: Role) {
    setSelected(r.id);
    setDraft(new Set(r.permissions));
    setMsg(null);
  }
  function toggle(code: string) {
    if (!current?.is_custom) return;
    setDraft((d) => { const n = new Set(d); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }
  async function save() {
    if (!current?.is_custom) return;
    const res = await fetch(`/api/v1/roles/${current.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: [...draft] }),
    });
    setMsg(res.ok ? 'Saved.' : 'Failed to save.');
    if (res.ok) load();
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/v1/roles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: newRole.code.toUpperCase(), name: newRole.name, permissions: [] }),
    });
    const j = await res.json();
    if (res.ok) { setCreating(false); setNewRole({ code: '', name: '' }); load(); setSelected(j.data.id); }
    else setMsg(j.error?.message ?? 'Failed to create role.');
  }

  if (!canManage) {
    return <div className="py-16 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
      Role management is restricted to administrators.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <span>Settings</span><ChevronRight className="w-3 h-3" /><span className="text-foreground">Roles & Permissions</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
          <Settings className="w-8 h-8" />Roles &amp; Permissions
        </h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Role list */}
        <div className="border border-border bg-background">
          <div className="p-3 border-b border-border bg-surface-hover flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Roles</span>
            <button onClick={() => setCreating((c) => !c)} className="text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /></button>
          </div>
          {creating && (
            <form onSubmit={create} className="p-3 space-y-2 border-b border-border">
              <input className="w-full h-8 px-2 bg-surface border border-border text-xs uppercase" placeholder="CODE"
                value={newRole.code} onChange={(e) => setNewRole((s) => ({ ...s, code: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))} required />
              <input className="w-full h-8 px-2 bg-surface border border-border text-xs" placeholder="Name"
                value={newRole.name} onChange={(e) => setNewRole((s) => ({ ...s, name: e.target.value }))} required />
              <button className="w-full h-8 bg-foreground text-background text-[10px] font-mono uppercase tracking-widest">Create</button>
            </form>
          )}
          <div className="max-h-[60vh] overflow-y-auto">
            {roles.map((r) => (
              <button key={r.id} onClick={() => selectRole(r)}
                className={`w-full text-left px-3 py-2 border-b border-border hover:bg-surface-hover ${selected === r.id ? 'bg-surface' : ''}`}>
                <div className="text-xs font-bold flex items-center gap-2">
                  {r.code}
                  {r.is_custom && <span className="font-mono text-[9px] border border-accent text-accent px-1">CUSTOM</span>}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">{r.permissions.length} permissions</div>
              </button>
            ))}
          </div>
        </div>

        {/* Permission editor */}
        <div className="md:col-span-2 border border-border bg-background">
          <div className="p-3 border-b border-border bg-surface-hover flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
              {current ? `${current.code} permissions` : 'Select a role'}
            </span>
            {current?.is_custom && (
              <button onClick={save} className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-foreground">
                <Save className="w-3 h-3" /> Save
              </button>
            )}
          </div>
          {msg && <div className="px-3 py-2 text-[10px] font-mono text-muted-foreground border-b border-border">{msg}</div>}
          {current && !current.is_custom && (
            <div className="px-3 py-2 text-[10px] font-mono text-muted-foreground border-b border-border">
              System role — read only. Create a custom role to edit permissions.
            </div>
          )}
          <div className="p-3 grid sm:grid-cols-2 gap-1 max-h-[60vh] overflow-y-auto">
            {current ? perms.map((p) => {
              const on = current.is_custom ? draft.has(p.code) : current.permissions.includes(p.code);
              return (
                <label key={p.code} className={`flex items-center gap-2 p-1.5 text-xs ${current.is_custom ? 'cursor-pointer hover:bg-surface-hover' : 'opacity-70'}`}>
                  <input type="checkbox" checked={on} disabled={!current.is_custom} onChange={() => toggle(p.code)} />
                  <span className="font-mono text-[10px]">{p.code}</span>
                </label>
              );
            }) : <p className="text-xs text-muted-foreground font-mono p-2">Pick a role on the left.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
