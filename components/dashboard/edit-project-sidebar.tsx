'use client';

import { useEffect, useState } from 'react';
import { X, PencilLine, AlertTriangle } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dialogLabelCls as labelCls, dialogFieldCls as fieldCls } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
  job_title: string | null;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SECURITY = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const HEALTHS = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'];

export function EditProjectSidebar({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [security, setSecurity] = useState('INTERNAL');
  const [status, setStatus] = useState('PLANNING');
  const [health, setHealth] = useState('ON_TRACK');
  const [pm, setPm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus trap / body scroll lock
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Load project details and employees
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [empRes, projRes] = await Promise.all([
          fetch('/api/v1/employees'),
          fetch(`/api/v1/projects/${projectId}`)
        ]);

        const empJson = await empRes.json().catch(() => null);
        const projJson = await projRes.json().catch(() => null);

        if (!active) return;

        if (Array.isArray(empJson?.data)) {
          setEmployees(empJson.data.map((m: any) => {
            const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
            return { id: m.id, name: p?.full_name ?? p?.email ?? 'Member', job_title: p?.job_title ?? null };
          }));
        }

        if (projJson?.data) {
          const p = projJson.data;
          setName(p.name || '');
          setCode(p.code || '');
          setDescription(p.description || '');
          setPriority(p.priority || 'MEDIUM');
          setSecurity(p.security_classification || 'INTERNAL');
          setStatus(p.status || 'PLANNING');
          setHealth(p.health || 'ON_TRACK');
          setPm(p.project_manager_member_id || '');
          setStartDate(p.start_date || '');
          setTargetDate(p.target_end_date || '');
        }
      } catch (err) {
        setError('Failed to load project details.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => { active = false; };
  }, [projectId]);

  const codeValid = /^[A-Z0-9]+$/.test(code);

  async function submit() {
    if (!name.trim()) { setError('Project name is required.'); return; }
    if (!code.trim()) { setError('Project code is required.'); return; }
    if (!codeValid) { setError('Code must be uppercase letters/numbers only (e.g. LGR2).'); return; }
    setSubmitting(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(), code: code.trim(), priority, security_classification: security, status, health
    };
    if (description.trim()) payload.description = description.trim();
    if (pm) payload.project_manager_member_id = pm;
    if (startDate) payload.start_date = startDate;
    if (targetDate) payload.target_end_date = targetDate;

    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSubmitting(false);
      setError(j?.error?.message ?? 'Failed to update project.');
      return;
    }
    setSubmitting(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background/95 backdrop-blur-xl h-full flex flex-col animate-in slide-in-from-right-full duration-300 border-l border-border/50 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 flex items-center justify-between shrink-0 border-b border-border/50">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <PencilLine className="w-4 h-4 text-foreground" /> Edit Project
          </h2>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <span className="font-mono text-xs uppercase text-muted-foreground animate-pulse">Loading...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="border border-destructive/50 bg-destructive/10 text-destructive text-[10px] uppercase font-mono tracking-widest px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" /> {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Project Name *</label>
                  <input data-testid="project-name-input" value={name} onChange={(e) => setName(e.target.value)}
                    className={fieldCls} placeholder="e.g. Ledger Migration" autoFocus />
                </div>
                <div>
                  <label className={labelCls}>Project Code *</label>
                  <input data-testid="project-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={cn(fieldCls, 'font-mono uppercase')} placeholder="e.g. LGR2" />
                  {code && !codeValid && (
                    <p className="text-[10px] font-mono text-destructive mt-1">Uppercase letters/numbers only.</p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-24 p-3 bg-background border border-border rounded text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
                  placeholder="Brief project objective and scope..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Health</label>
                  <Select value={health} onValueChange={setHealth}>
                    <SelectTrigger className={fieldCls}>
                      <SelectValue placeholder="Select Health" />
                    </SelectTrigger>
                    <SelectContent>
                      {HEALTHS.map((h) => <SelectItem key={h} value={h}>{h.replace('_', ' ')}</SelectItem>)}
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
                  <label className={labelCls}>Security</label>
                  <Select value={security} onValueChange={setSecurity}>
                    <SelectTrigger className={fieldCls}>
                      <SelectValue placeholder="Select Security" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECURITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div>
                  <label className={labelCls}>Target Date</label>
                  <DatePicker value={targetDate} onChange={setTargetDate} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 flex flex-col sm:flex-row justify-end gap-3 shrink-0 border-t border-border/50 bg-surface">
          <button onClick={onClose} className="h-9 px-4 border border-border rounded font-mono text-[10px] uppercase tracking-widest transition-colors hover:bg-surface-hover">
            Cancel
          </button>
          <button data-testid="project-save-button" onClick={submit} disabled={submitting || loading}
            className="h-9 px-4 bg-foreground text-background rounded font-mono text-[10px] uppercase tracking-widest transition-colors hover:bg-foreground/90 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
