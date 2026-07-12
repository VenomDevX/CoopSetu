'use client';

import { useEffect, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { Dialog, dialogLabelCls as labelCls, dialogFieldCls as fieldCls } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  return (
    <Dialog
      title="Create Project"
      icon={FolderPlus}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 border border-border rounded-[6px] font-mono text-xs uppercase tracking-widest">Cancel</button>
          <button data-testid="project-save-button" onClick={submit} disabled={submitting}
            className="h-9 px-4 bg-foreground text-background rounded-[6px] font-mono text-xs uppercase tracking-widest disabled:opacity-50">
            {submitting ? 'Creating…' : 'Initialize Project'}
          </button>
        </>
      }
    >
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
              className="w-full h-20 p-3 bg-background border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
              placeholder="Brief project objective and scope..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue placeholder="Select Priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Security Classification</label>
              <Select value={security} onValueChange={setSecurity}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue placeholder="Select Classification" />
                </SelectTrigger>
                <SelectContent>
                  {SECURITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Project Manager</label>
              <Select value={pm} onValueChange={setPm}>
                <SelectTrigger className={fieldCls} data-testid="project-pm-select">
                  <SelectValue placeholder="— Unassigned —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Unassigned —</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{[e.name, e.job_title].filter(Boolean).join(' · ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </Dialog>
  );
}

