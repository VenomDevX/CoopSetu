'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <Dialog
      title="Create Bug"
      onClose={onClose}
      bodyClassName="space-y-6 text-sm font-mono"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded font-mono uppercase tracking-widest text-[10px]">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded bg-foreground text-background font-mono uppercase tracking-widest text-[10px]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Bug
          </Button>
        </>
      }
    >
          {error && <div className="p-3 border border-red-500/20 bg-red-500/10 text-red-400 uppercase tracking-widest text-[10px]">{error}</div>}
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Bug Title *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Login button unresponsive" className="rounded border-border" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Project *</label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground">
                    <SelectValue placeholder="-- Select Project --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Select Project --</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Environment</label>
                <Input value={environment} onChange={e => setEnvironment(e.target.value)} placeholder="e.g., Production, Staging" className="rounded border-border" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Severity</label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground">
                    <SelectValue placeholder="Select Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Linked Task</label>
                <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
                  <SelectTrigger className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground disabled:opacity-50">
                    <SelectValue placeholder="-- None --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- None --</SelectItem>
                    {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Primary Assignee *</label>
                <Select value={primaryAssignee} onValueChange={setPrimaryAssignee}>
                  <SelectTrigger className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground">
                    <SelectValue placeholder="-- Select Member --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Select Member --</SelectItem>
                    {employees.map(m => <SelectItem key={m.id} value={m.id}>{m.name} {m.job_title ? `(${m.job_title})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full min-h-[80px] p-3 border border-border rounded bg-background outline-none focus:border-foreground resize-y" />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Steps to Reproduce</label>
              <textarea value={steps} onChange={e => setSteps(e.target.value)} className="w-full min-h-[80px] p-3 border border-border rounded bg-background outline-none focus:border-foreground resize-y" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Expected Result</label>
                <textarea value={expected} onChange={e => setExpected(e.target.value)} className="w-full min-h-[80px] p-3 border border-border rounded bg-background outline-none focus:border-foreground resize-y" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Actual Result</label>
                <textarea value={actual} onChange={e => setActual(e.target.value)} className="w-full min-h-[80px] p-3 border border-border rounded bg-background outline-none focus:border-foreground resize-y" />
              </div>
            </div>

          </div>
    </Dialog>
  );
}
