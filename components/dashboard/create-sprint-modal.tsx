'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface Project { id: string; name: string; code: string }

/**
 * Real Create Sprint modal — posts to `POST /api/v1/sprints` (requires
 * `sprint:create`). No fake success: API errors are surfaced verbatim.
 */
export function CreateSprintModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState('');
  const [points, setPoints] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/projects')
      .then((r) => r.json())
      .then((j) => { if (active) setProjects(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function submit() {
    if (!projectId) { setError('Select a project.'); return; }
    if (!name.trim()) { setError('Sprint name is required.'); return; }
    setSubmitting(true);
    setError(null);
    const payload: Record<string, unknown> = { project_id: projectId, name: name.trim() };
    if (goal.trim()) payload.goal = goal.trim();
    if (startDate) payload.start_date = startDate;
    if (endDate) payload.end_date = endDate;
    if (capacity) payload.capacity_hours = Number(capacity);
    if (points) payload.planned_story_points = Number(points);

    const res = await fetch('/api/v1/sprints', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSubmitting(false);
      setError(j?.error?.message ?? 'Failed to create sprint.');
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
      <div className="relative w-full max-w-lg bg-background sm:border sm:border-border sm:shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between shrink-0">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-foreground" /> Create Sprint
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className={labelCls}>Project *</label>
            <select data-testid="sprint-project-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={fieldCls}>
              <option value="">— Select project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sprint Name *</label>
            <input data-testid="sprint-name-input" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} placeholder="e.g. Sprint 12" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground transition-colors resize-none" placeholder="Sprint objective…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${fieldCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${fieldCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Capacity (hrs)</label>
              <input type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Planned Story Points</label>
              <input type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} className={fieldCls} />
            </div>
          </div>
          {error && <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
          <button onClick={onClose} className="h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest">Cancel</button>
          <button data-testid="sprint-save-button" onClick={submit} disabled={submitting} className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create Sprint'}
          </button>
        </div>
      </div>
    </div>
  );
}
