'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Employee {
  id: string;
  name: string;
  job_title: string | null;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Task {
  id: string;
  title: string;
}

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function CreateBugModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void; }) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [environment, setEnvironment] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [taskId, setTaskId] = useState('');
  const [primaryAssignee, setPrimaryAssignee] = useState('');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/projects').then(r => r.json()).then(j => setProjects(j.data || []));
    fetch('/api/v1/employees').then(r => r.json()).then(j => {
      if (Array.isArray(j.data)) {
        setEmployees(j.data.map((m: any) => {
          const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          return { id: m.id, name: p?.full_name ?? p?.email ?? 'Member', job_title: p?.job_title ?? null };
        }));
      }
    });
  }, []);

  useEffect(() => {
    if (projectId) {
      fetch(`/api/v1/tasks?project_id=${projectId}`).then(r => r.json()).then(j => setTasks(j.data || []));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTasks([]);
    }
  }, [projectId]);

  async function submit() {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!projectId) { setError('Project is required.'); return; }
    if (!primaryAssignee) { setError('Primary Assignee is required.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, project_id: projectId, environment, severity, priority,
          description, steps_to_reproduce: steps, expected_result: expected, actual_result: actual,
          task_id: taskId || undefined, primary_assignee_member_id: primaryAssignee,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to create bug');
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover shrink-0">
          <h2 className="text-sm font-mono uppercase tracking-widest font-bold">Create Bug</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6 text-sm font-mono flex-1">
          {error && <div className="p-3 border border-red-500/20 bg-red-500/10 text-red-400 uppercase tracking-widest text-[10px]">{error}</div>}
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Bug Title *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Login button unresponsive" className="rounded-none border-border" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Project *</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full h-10 border border-border bg-background px-3 outline-none focus:border-foreground">
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Environment</label>
                <Input value={environment} onChange={e => setEnvironment(e.target.value)} placeholder="e.g., Production, Staging" className="rounded-none border-border" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Severity</label>
                <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full h-10 border border-border bg-background px-3 outline-none focus:border-foreground">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full h-10 border border-border bg-background px-3 outline-none focus:border-foreground">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Linked Task</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} disabled={!projectId} className="w-full h-10 border border-border bg-background px-3 outline-none focus:border-foreground disabled:opacity-50">
                  <option value="">-- None --</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Primary Assignee *</label>
                <select value={primaryAssignee} onChange={e => setPrimaryAssignee(e.target.value)} className="w-full h-10 border border-border bg-background px-3 outline-none focus:border-foreground">
                  <option value="">-- Select Member --</option>
                  {employees.map(m => <option key={m.id} value={m.id}>{m.name} {m.job_title ? `(${m.job_title})` : ''}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full min-h-[80px] p-3 border border-border bg-background outline-none focus:border-foreground resize-y" />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Steps to Reproduce</label>
              <textarea value={steps} onChange={e => setSteps(e.target.value)} className="w-full min-h-[80px] p-3 border border-border bg-background outline-none focus:border-foreground resize-y" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Expected Result</label>
                <textarea value={expected} onChange={e => setExpected(e.target.value)} className="w-full min-h-[80px] p-3 border border-border bg-background outline-none focus:border-foreground resize-y" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Actual Result</label>
                <textarea value={actual} onChange={e => setActual(e.target.value)} className="w-full min-h-[80px] p-3 border border-border bg-background outline-none focus:border-foreground resize-y" />
              </div>
            </div>

          </div>
        </div>
        <div className="p-4 border-t border-border bg-surface-hover flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-none font-mono uppercase tracking-widest text-[10px]">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-none bg-foreground text-background font-mono uppercase tracking-widest text-[10px]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Bug
          </Button>
        </div>
      </div>
    </div>
  );
}
