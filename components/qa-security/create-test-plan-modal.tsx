'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function CreateTestPlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void; }) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [ownerMemberId, setOwnerMemberId] = useState('');
  const [environment, setEnvironment] = useState('');
  const [scope, setScope] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  const [testCases, setTestCases] = useState([{ title: '', steps: '', expected_result: '', priority: 'MEDIUM' }]);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
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

  async function submit() {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!projectId) { setError('Project is required.'); return; }
    if (!ownerMemberId) { setError('QA Owner is required.'); return; }
    if (testCases.some(tc => !tc.title.trim())) { setError('All test cases must have a title.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/test-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, project_id: projectId, owner_member_id: ownerMemberId,
          environment, scope, acceptance_criteria: acceptanceCriteria,
          due_date: dueDate || undefined,
          test_cases: testCases
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to create test plan');
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      title="Create Test Plan"
      onClose={onClose}
      className="max-w-3xl"
      bodyClassName="space-y-6 text-sm font-mono"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-none font-mono uppercase tracking-widest text-[10px]">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-none bg-foreground text-background font-mono uppercase tracking-widest text-[10px]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Test Plan
          </Button>
        </>
      }
    >
          {error && <div className="p-3 border border-red-500/20 bg-red-500/10 text-red-400 uppercase tracking-widest text-[10px]">{error}</div>}
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Test Plan Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Release 2.0 Regression" className="rounded-none border-border" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Project *</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full h-10 border border-border bg-background px-3 outline-none focus:border-foreground">
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">QA Owner *</label>
                <select value={ownerMemberId} onChange={e => setOwnerMemberId(e.target.value)} className="w-full h-10 border border-border bg-background px-3 outline-none focus:border-foreground">
                  <option value="">-- Select Member --</option>
                  {employees.map(m => <option key={m.id} value={m.id}>{m.name} {m.job_title ? `(${m.job_title})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Target Date</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-none border-border" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Environment</label>
                <Input value={environment} onChange={e => setEnvironment(e.target.value)} placeholder="e.g., Staging" className="rounded-none border-border" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Scope</label>
                <Input value={scope} onChange={e => setScope(e.target.value)} placeholder="e.g., Core API endpoints" className="rounded-none border-border" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Acceptance Criteria</label>
              <textarea value={acceptanceCriteria} onChange={e => setAcceptanceCriteria(e.target.value)} className="w-full min-h-[60px] p-3 border border-border bg-background outline-none focus:border-foreground resize-y" />
            </div>

            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Test Cases</h3>
                <Button variant="outline" size="sm" onClick={() => setTestCases([...testCases, { title: '', steps: '', expected_result: '', priority: 'MEDIUM' }])} className="rounded-none font-mono text-[10px] uppercase">
                  <Plus className="w-3 h-3 mr-1" /> Add Case
                </Button>
              </div>

              <div className="space-y-4">
                {testCases.map((tc, idx) => (
                  <div key={idx} className="p-4 border border-border bg-surface-hover/50 space-y-3 relative group">
                    <button onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-[1fr_120px] gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Title *</label>
                        <Input value={tc.title} onChange={e => { const nc = [...testCases]; nc[idx].title = e.target.value; setTestCases(nc); }} className="rounded-none border-border h-8" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Priority</label>
                        <select value={tc.priority} onChange={e => { const nc = [...testCases]; nc[idx].priority = e.target.value; setTestCases(nc); }} className="w-full h-8 border border-border bg-background px-2 outline-none focus:border-foreground">
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Steps</label>
                        <textarea value={tc.steps} onChange={e => { const nc = [...testCases]; nc[idx].steps = e.target.value; setTestCases(nc); }} className="w-full min-h-[60px] p-2 border border-border bg-background outline-none focus:border-foreground resize-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Expected Result</label>
                        <textarea value={tc.expected_result} onChange={e => { const nc = [...testCases]; nc[idx].expected_result = e.target.value; setTestCases(nc); }} className="w-full min-h-[60px] p-2 border border-border bg-background outline-none focus:border-foreground resize-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
    </Dialog>
  );
}
