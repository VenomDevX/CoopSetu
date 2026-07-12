'use client';

import { useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    let active = true;
    if (!selectedProject) {
      // Use queueMicrotask to avoid synchronous setState in effect
      queueMicrotask(() => {
        if (active) {
          setMembers([]);
          setSprints([]);
          setEpics([]);
        }
      });
      return () => { active = false; };
    }
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
  const fieldCls = 'w-full h-9 px-3 bg-background border border-border rounded-[6px] text-sm';

  return (
    <Dialog
      title={`New Task${projectLabel ? ` · ${projectLabel}` : ''}`}
      icon={ListTodo}
      onClose={onClose}
      testId="create-task-modal"
      className="max-w-4xl"
      bodyClassName="!space-y-0"
      footer={
        <>
          <button onClick={onClose} className="h-9 px-4 border border-border rounded-[6px] text-xs font-mono uppercase">Cancel</button>
          <button data-testid="task-save-button" onClick={submit} disabled={submitting}
            className="h-9 px-4 rounded-[6px] bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create Task'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Main Content */}
        <div className="space-y-5 flex flex-col">
          <div>
            <label className={labelCls}>Title *</label>
            <input data-testid="task-title-input" autoFocus={!!projectId} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?" className={fieldCls} />
          </div>

          <div className="flex-1 flex flex-col">
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full flex-1 min-h-[120px] p-3 bg-background border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors resize-none" />
          </div>

          <div>
            <label className={labelCls}>Acceptance Criteria</label>
            <textarea value={acceptance} onChange={(e) => setAcceptance(e.target.value)}
              rows={3} className="w-full p-3 bg-background border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors resize-none" />
          </div>

          {members.length > 0 && (
            <div>
              <label className={labelCls}>Additional Assignees</label>
              <select
                data-testid="task-additional-assignees"
                multiple
                value={additional}
                onChange={(e) => setAdditional([...e.target.selectedOptions].map((o) => o.value))}
                className="w-full px-2 py-1 bg-surface/80 backdrop-blur-md border border-border rounded-[6px] text-xs min-h-[72px] focus:outline-none focus:border-foreground"
              >
                {members.filter((m) => m.member_id !== assignee).map((m) => (
                  <option key={m.member_id} value={m.member_id}>{memberLabel(m)}</option>
                ))}
              </select>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">Ctrl/Cmd-click to select multiple.</p>
            </div>
          )}
        </div>

        {/* Right Column: Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 h-fit">
          {!projectId && (
            <div className="col-span-2">
              <label className={labelCls}>Project *</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue placeholder="— Select Project —" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className={labelCls}>Type</label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger className={fieldCls}>
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
            <label className={labelCls}>Epic</label>
            <Select value={epicId} onValueChange={setEpicId}>
              <SelectTrigger className={fieldCls} data-testid="task-epic-select">
                <SelectValue placeholder="— None —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {epics.map((ep) => <SelectItem key={ep.id} value={ep.id}>{ep.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>Sprint</label>
            <Select value={sprintId} onValueChange={setSprintId}>
              <SelectTrigger className={fieldCls}>
                <SelectValue placeholder="— None —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Assignee {members.length > 0 && `(${members.length} eligible)`}</label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className={fieldCls} data-testid="task-assignee-select">
                <SelectValue placeholder="— Unassigned —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Unassigned —</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.member_id} value={m.member_id}>{memberLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {members.length === 0 && (
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                No eligible members — add project members or a project team first.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldCls} />
          </div>

          <div>
            <label className={labelCls}>Visibility</label>
            <Select value={visibilityScope} onValueChange={setVisibilityScope}>
              <SelectTrigger className={fieldCls}>
                <SelectValue placeholder="Select Visibility" />
              </SelectTrigger>
              <SelectContent>
                {TASK_VISIBILITY_SCOPES.map((scope) => (
                  <SelectItem key={scope} value={scope}>{scope.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>Security Classification</label>
            <Select value={securityClass} onValueChange={setSecurityClass}>
              <SelectTrigger className={fieldCls}>
                <SelectValue placeholder="— Default —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Default —</SelectItem>
                {SECURITY_CLASSIFICATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
      </div>

      {error && (
        <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono mt-4">
          {error}
        </div>
      )}
    </Dialog>
  );
}

