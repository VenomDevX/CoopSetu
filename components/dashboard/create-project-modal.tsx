'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  job_title: string | null;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SECURITY = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

/**
 * Real Create Project modal — posts to `POST /api/v1/projects` (requires
 * `project:create`), validates client-side, then calls `onCreated` so the list
 * refreshes. No fake success: errors from the API are surfaced verbatim.
 */
export function CreateProjectModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [security, setSecurity] = useState('INTERNAL');
  const [status, setStatus] = useState('PLANNING');
  const [pm, setPm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/employees')
      .then((r) => r.json())
      .then((j) => {
        if (!active || !Array.isArray(j?.data)) return;
        setEmployees(j.data.map((m: { id: string; profile: { full_name?: string; email?: string; job_title?: string } | { full_name?: string; email?: string; job_title?: string }[] | null }) => {
          const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          return { id: m.id, name: p?.full_name ?? p?.email ?? 'Member', job_title: p?.job_title ?? null };
        }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const codeValid = /^[A-Z0-9]+$/.test(code);

  async function submit() {
    if (!name.trim()) { setError('Project name is required.'); return; }
    if (!code.trim()) { setError('Project code is required.'); return; }
    if (!codeValid) { setError('Code must be uppercase letters/numbers only (e.g. LGR2).'); return; }
    setSubmitting(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(), code: code.trim(), priority, security_classification: security, status,
    };
    if (description.trim()) payload.description = description.trim();
    if (pm) payload.project_manager_member_id = pm;
    if (startDate) payload.start_date = startDate;
    if (targetDate) payload.target_end_date = targetDate;

    const res = await fetch('/api/v1/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSubmitting(false);
      setError(j?.error?.message ?? 'Failed to create project.');
      return;
    }
    setSubmitting(false);
    onCreated();
    onClose();
  }

  const labelCls = 'text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block';
  const fieldCls = 'w-full h-9 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl bg-background sm:border sm:border-border sm:shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between shrink-0">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-foreground" /> Create Project
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Project Name *</label>
              <input data-testid="project-name-input" value={name} onChange={(e) => setName(e.target.value)}
                className={fieldCls} placeholder="e.g. Ledger Migration" autoFocus />
            </div>
            <div>
              <label className={labelCls}>Project Code *</label>
              <input data-testid="project-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={`${fieldCls} font-mono uppercase`} placeholder="e.g. LGR2" />
              {code && !codeValid && (
                <p className="text-[10px] font-mono text-red-500 mt-1">Uppercase letters/numbers only.</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full h-20 p-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
              placeholder="Brief project objective and scope..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldCls}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Security Classification</label>
              <select value={security} onChange={(e) => setSecurity(e.target.value)} className={fieldCls}>
                {SECURITY.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Project Manager</label>
              <select data-testid="project-pm-select" value={pm} onChange={(e) => setPm(e.target.value)} className={fieldCls}>
                <option value="">— Unassigned —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{[e.name, e.job_title].filter(Boolean).join(' · ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${fieldCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Target Date</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`${fieldCls} font-mono`} />
            </div>
          </div>

          {error && (
            <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
          <button onClick={onClose} className="h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest">Cancel</button>
          <button data-testid="project-save-button" onClick={submit} disabled={submitting}
            className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50">
            {submitting ? 'Creating…' : 'Initialize Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
