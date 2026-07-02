'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { TASK_TYPES, TASK_VISIBILITY_SCOPES, PRIORITIES, SECURITY_CLASSIFICATIONS } from '@/lib/constants/task-statuses';

interface AssignableMember {
  member_id: string;
  full_name: string;
  job_title: string | null;
  team_name: string | null;
  role: string | null;
  capacity_percent: number | null;
}
interface Sprint { id: string; name: string; status?: string }
interface Epic { id: string; title: string; status?: string }

/** Human label per the assignment spec: "Name · Title · Team · ROLE · NN% allocated". */
function memberLabel(m: AssignableMember) {
  const titleTeam = [m.job_title, m.team_name].filter(Boolean).join(' · ');
  const roleCap = [m.role, m.capacity_percent != null ? `${m.capacity_percent}% allocated` : null]
    .filter(Boolean).join(' · ');
  return [m.full_name, titleTeam, roleCap].filter(Boolean).join('  ·  ');
}

export function CreateTaskModal({
  projectId, projectLabel, onClose, onCreated,
}: {
  projectId?: string;
  projectLabel?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  const [availableProjects, setAvailableProjects] = useState<{id: string, name: string}[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<string>('TASK');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [sprintId, setSprintId] = useState('');
  const [epicId, setEpicId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [additional, setAdditional] = useState<string[]>([]);
  const [visibilityScope, setVisibilityScope] = useState<string>('PRIVATE_ASSIGNMENT');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [storyPoints, setStoryPoints] = useState('');
  const [securityClass, setSecurityClass] = useState('');
  const [acceptance, setAcceptance] = useState('');

  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) return; // Only fetch projects if none was provided
    let active = true;
    fetch('/api/v1/projects')
      .then((r) => r.json())
      .then((j) => { if (active) setAvailableProjects(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!selectedProject) {
      setMembers([]);
      setSprints([]);
      setEpics([]);
      return;
    }
    let active = true;
    fetch(`/api/v1/projects/${selectedProject}/assignable-members`)
      .then((r) => r.json())
      .then((j) => { if (active) setMembers(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    fetch(`/api/v1/sprints?projectId=${selectedProject}`)
      .then((r) => r.json())
      .then((j) => { if (active) setSprints(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    fetch(`/api/v1/projects/${selectedProject}/epics`)
      .then((r) => r.json())
      .then((j) => { if (active) setEpics(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    return () => { active = false; };
  }, [selectedProject]);

  async function submit() {
    if (!selectedProject) { setError('A project must be selected.'); return; }
    if (!title.trim()) { setError('Title is required.'); return; }
    setSubmitting(true);
    setError(null);
    const payload: Record<string, unknown> = {
      project_id: selectedProject,
      title: title.trim(),
      task_type: taskType,
      priority,
      status: 'BACKLOG',
      visibility_scope: visibilityScope,
    };
    if (description.trim()) payload.description = description.trim();
    if (sprintId) payload.sprint_id = sprintId;
    if (epicId) payload.epic_id = epicId;
    if (dueDate) payload.due_date = dueDate;
    if (startDate) payload.start_date = startDate;
    if (assignee) payload.primary_assignee_member_id = assignee;
    if (estimatedHours) payload.estimated_hours = Number(estimatedHours);
    if (storyPoints) payload.story_points = Number(storyPoints);
    if (securityClass) payload.security_classification = securityClass;
    if (acceptance.trim()) payload.acceptance_criteria = acceptance.trim();

    const res = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSubmitting(false);
      setError(j?.error?.message ?? 'Failed to create task.');
      return;
    }

    // Additional assignees: persisted individually (each validated server-side).
    const newId = j?.data?.id;
    const extras = additional.filter((id) => id && id !== assignee);
    if (newId && extras.length) {
      await Promise.all(extras.map((id) =>
        fetch(`/api/v1/tasks/${newId}/assignees`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ organization_member_id: id, assignment_type: 'ADDITIONAL' }),
        }).catch(() => {}),
      ));
    }
    setSubmitting(false);
    onCreated();
    onClose();
  }

  const labelCls = 'font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block';
  const fieldCls = 'w-full h-9 px-3 bg-background border border-border text-sm';

  return (
    <Dialog
      title={`New Task${projectLabel ? ` · ${projectLabel}` : ''}`}
      onClose={onClose}
      testId="create-task-modal"
      className="max-w-lg"
      bodyClassName="space-y-4"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 border border-border text-xs font-mono uppercase">Cancel</button>
          <button data-testid="task-save-button" onClick={submit} disabled={submitting}
            className="h-9 px-4 bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create Task'}
          </button>
        </>
      }
    >
          {!projectId && (
            <div>
              <label className={labelCls}>Project *</label>
              <select 
                value={selectedProject} 
                onChange={(e) => setSelectedProject(e.target.value)} 
                className={fieldCls}
                autoFocus
              >
                <option value="">— Select Project —</option>
                {availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Title *</label>
            <input data-testid="task-title-input" autoFocus={!!projectId} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?" className={fieldCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="w-full px-3 py-2 bg-background border border-border text-sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className={fieldCls}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldCls}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Epic</label>
              <select data-testid="task-epic-select" value={epicId} onChange={(e) => setEpicId(e.target.value)} className={fieldCls}>
                <option value="">— None —</option>
                {epics.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sprint</label>
              <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className={fieldCls}>
                <option value="">— None —</option>
                {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldCls} />
          </div>

          <div>
            <label className={labelCls}>Assignee {members.length > 0 && `(${members.length} eligible)`}</label>
            <select data-testid="task-assignee-select" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={fieldCls}>
              <option value="">— Unassigned —</option>
              {members.map((m) => (
                <option key={m.member_id} value={m.member_id}>{memberLabel(m)}</option>
              ))}
            </select>
            {members.length === 0 && (
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                No eligible members — add project members or a project team first.
              </p>
            )}
          </div>

          {members.length > 0 && (
            <div>
              <label className={labelCls}>Additional Assignees</label>
              <select
                data-testid="task-additional-assignees"
                multiple
                value={additional}
                onChange={(e) => setAdditional([...e.target.selectedOptions].map((o) => o.value))}
                className="w-full px-2 py-1 bg-background border border-border text-xs min-h-[72px]"
              >
                {members.filter((m) => m.member_id !== assignee).map((m) => (
                  <option key={m.member_id} value={m.member_id}>{memberLabel(m)}</option>
                ))}
              </select>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">Ctrl/Cmd-click to select multiple.</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Visibility</label>
            <select value={visibilityScope} onChange={(e) => setVisibilityScope(e.target.value)} className={fieldCls}>
              {TASK_VISIBILITY_SCOPES.map((scope) => (
                <option key={scope} value={scope}>{scope.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Security Classification</label>
              <select value={securityClass} onChange={(e) => setSecurityClass(e.target.value)} className={fieldCls}>
                <option value="">— Default —</option>
                {SECURITY_CLASSIFICATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Estimated Hours</label>
              <input type="number" min="0" step="0.5" value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Story Points</label>
              <input type="number" min="0" step="1" value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Acceptance Criteria</label>
            <textarea value={acceptance} onChange={(e) => setAcceptance(e.target.value)}
              rows={2} className="w-full px-3 py-2 bg-background border border-border text-sm" />
          </div>

          {error && (
            <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">
              {error}
            </div>
          )}
    </Dialog>
  );
}
