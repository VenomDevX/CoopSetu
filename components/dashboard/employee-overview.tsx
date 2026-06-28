'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Clock, AlertOctagon, CheckSquare } from 'lucide-react';
import { useCurrentMembership } from '@/lib/permissions/context';

const CLOSED = ['DONE', 'CANCELLED'];

interface Task {
  id: string;
  task_key: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

/** Personal, role-appropriate overview for employees (no company analytics). */
export function EmployeeOverview() {
  const membership = useCurrentMembership();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/tasks?mine=true')
      .then((r) => r.json())
      .then((j) => { if (active) setTasks(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((t) => !CLOSED.includes(t.status));
  const dueToday = open.filter((t) => t.due_date === today);
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const blocked = open.filter((t) => t.status === 'BLOCKED');

  const kpis = [
    { label: 'Active Tasks', value: open.length, icon: CheckSquare },
    { label: 'Due Today', value: dueToday.length, icon: Clock },
    { label: 'Overdue', value: overdue.length, icon: AlertOctagon },
    { label: 'Blocked', value: blocked.length, icon: Briefcase },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      <div className="border-b border-border pb-6">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">My_Workspace</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter uppercase">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
          {membership.organizationName} · Your assigned work and deadlines
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="p-5 border border-border bg-surface relative overflow-hidden">
            <k.icon className="absolute top-3 right-3 w-8 h-8 opacity-10" />
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{k.label}</div>
            <div className="text-4xl font-bold tracking-tighter">{String(k.value).padStart(2, '0')}</div>
          </div>
        ))}
      </div>

      <div className="border border-border bg-background">
        <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between">
          <h3 className="font-mono text-xs uppercase tracking-widest font-bold">My Tasks</h3>
          <Link href="/dashboard/my-work" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Open My Work →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {open.slice(0, 8).map((t) => (
            <Link key={t.id} href="/dashboard/my-work"
              className="flex items-center gap-3 p-3 hover:bg-surface-hover transition-colors">
              <span className="font-mono text-[10px] px-2 py-0.5 bg-surface border border-border text-muted-foreground">{t.task_key}</span>
              <span className="text-sm flex-1 truncate">{t.title}</span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{t.status}</span>
            </Link>
          ))}
          {open.length === 0 && (
            <div className="p-6 text-center text-xs font-mono text-muted-foreground uppercase tracking-widest">
              No active tasks assigned to you.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
