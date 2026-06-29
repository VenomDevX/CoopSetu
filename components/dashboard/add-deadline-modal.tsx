'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

interface Project {
  id: string;
  code: string;
  name: string;
}

interface Sprint {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  job_title: string | null;
}

export function AddDeadlineModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projectId, setProjectId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('PLANNED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/projects')
      .then((r) => r.json())
      .then((j) => { if (active) setProjects(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
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

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    fetch(`/api/v1/sprints?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((j) => { if (active) setSprints(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  async function submit() {
    if (!projectId) { setError('Select a project.'); return; }
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!dueDate) { setError('Due date is required.'); return; }

    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      project_id: projectId,
      title: title.trim(),
      due_date: dueDate,
      status,
    };
    if (sprintId) payload.sprint_id = sprintId;
    if (owner) payload.owner_member_id = owner;
    if (description.trim()) payload.description = description.trim();

    const res = await fetch('/api/v1/project-deadlines', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Failed to create deadline.');
      return;
    }
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
            <CalendarDays className="w-4 h-4" /> Add Deadline
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Project *</label>
              <select
                data-testid="deadline-project-select"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setSprintId('');
                  setSprints([]);
                }}
                className={fieldCls}
              >
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sprint</label>
              <select data-testid="deadline-sprint-select" value={sprintId} onChange={(e) => setSprintId(e.target.value)} className={fieldCls} disabled={!projectId}>
                <option value="">No sprint link</option>
                {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Title *</label>
              <input data-testid="deadline-title-input" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} placeholder="e.g. Security sign-off" autoFocus />
            </div>
            <div>
              <label className={labelCls}>Due Date *</label>
              <input data-testid="deadline-date-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${fieldCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Owner</label>
              <select data-testid="deadline-owner-select" value={owner} onChange={(e) => setOwner(e.target.value)} className={fieldCls}>
                <option value="">Unassigned</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{[e.name, e.job_title].filter(Boolean).join(' - ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                {['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full h-20 p-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
              placeholder="Deadline context..." />
          </div>

          {error && <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
          <button onClick={onClose} className="h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest">Cancel</button>
          <button data-testid="deadline-save-button" onClick={submit} disabled={busy}
            className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50">
            {busy ? 'Creating...' : 'Create Deadline'}
          </button>
        </div>
      </div>
    </div>
  );
}
