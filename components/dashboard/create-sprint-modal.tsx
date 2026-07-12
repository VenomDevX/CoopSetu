'use client';

import { useEffect, useState } from 'react';
import { Dialog, dialogLabelCls as labelCls, dialogFieldCls as fieldCls } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  return (
    <Dialog
      title="Create Sprint"
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 border border-border rounded-[6px] font-mono text-xs uppercase tracking-widest">Cancel</button>
          <button data-testid="sprint-save-button" onClick={submit} disabled={submitting} className="h-9 px-4 bg-foreground text-background rounded-[6px] font-mono text-xs uppercase tracking-widest disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create Sprint'}
          </button>
        </>
      }
    >
          <div>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className={fieldCls} data-testid="sprint-project-select">
                <SelectValue placeholder="— Select project —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Select project —</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>Sprint Name *</label>
            <input data-testid="sprint-name-input" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} placeholder="e.g. Sprint 12" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors resize-none" placeholder="Sprint objective…" />
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
    </Dialog>
  );
}

