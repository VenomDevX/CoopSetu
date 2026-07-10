'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
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

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function StartSecurityReviewModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void; }) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [reviewerMemberId, setReviewerMemberId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [riskLevel, setRiskLevel] = useState('MEDIUM');
  const [scope, setScope] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  
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
    if (!reviewerMemberId) { setError('Primary Security Reviewer is required.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/security-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, project_id: projectId, reviewer_member_id: reviewerMemberId,
          task_id: taskId || undefined, risk_level: riskLevel,
          scope, description, due_date: dueDate || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to start security review');
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      title="Start Security Review"
      onClose={onClose}
      bodyClassName="space-y-6 text-sm font-mono"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded font-mono uppercase tracking-widest text-[10px]">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded bg-foreground text-background font-mono uppercase tracking-widest text-[10px]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Start Review
          </Button>
        </>
      }
    >
          {error && <div className="p-3 border border-red-500/20 bg-red-500/10 text-red-400 uppercase tracking-widest text-[10px]">{error}</div>}
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Review Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Auth API Security Audit" className="rounded border-border" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Project *</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground">
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Primary Reviewer *</label>
                <select value={reviewerMemberId} onChange={e => setReviewerMemberId(e.target.value)} className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground">
                  <option value="">-- Select Member --</option>
                  {employees.map(m => <option key={m.id} value={m.id}>{m.name} {m.job_title ? `(${m.job_title})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Due Date</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded border-border" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Risk Level</label>
                <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground">
                  {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Linked Task</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} disabled={!projectId} className="w-full h-10 border border-border rounded bg-background px-3 outline-none focus:border-foreground disabled:opacity-50">
                  <option value="">-- None --</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Scope</label>
              <Input value={scope} onChange={e => setScope(e.target.value)} placeholder="e.g., Penetration test, code review..." className="rounded border-border" />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full min-h-[80px] p-3 border border-border rounded bg-background outline-none focus:border-foreground resize-y" />
            </div>

          </div>
    </Dialog>
  );
}
