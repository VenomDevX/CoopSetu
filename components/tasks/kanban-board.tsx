'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, useDroppable, useDraggable,
} from '@dnd-kit/core';
import { useBoardRealtime } from '@/hooks/use-board-realtime';
import { TaskDrawer } from '@/components/tasks/task-drawer';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';
import { usePermission } from '@/lib/permissions/context';

const COLUMNS = [
  { key: 'BACKLOG', label: 'Backlog' },
  { key: 'READY', label: 'Ready' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'CODE_REVIEW', label: 'Code Review' },
  { key: 'QA_TESTING', label: 'QA' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'READY_FOR_RELEASE', label: 'Ready / Release' },
  { key: 'DONE', label: 'Done' },
] as const;

interface Task {
  id: string;
  task_key: string;
  title: string;
  status: string;
  priority: string;
  primary_assignee_member_id: string | null;
}
interface Project { id: string; code: string; name: string }

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-500', HIGH: 'text-orange-500', MEDIUM: 'text-muted-foreground', LOW: 'text-muted-foreground',
};

function Card({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card border border-border rounded bg-background p-3 mb-2 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {task.task_key}
        </span>
        <span className={`font-mono text-[10px] uppercase ${PRIORITY_COLOR[task.priority] ?? ''}`}>{task.priority}</span>
      </div>
      <button 
        onPointerDown={(e) => e.stopPropagation()} 
        onClick={() => onOpen(task.id)} 
        className="text-left text-sm leading-snug hover:underline w-full"
      >
        {task.title}
      </button>
    </div>
  );
}

function Column({ col, tasks, onOpen }: { col: { key: string; label: string }; tasks: Task[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div className="w-72 flex-shrink-0 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest">{col.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className={`flex-1 min-h-[10rem] overflow-y-auto p-2 border border-border rounded scrollbar-thin ${isOver ? 'bg-surface-hover' : 'bg-surface'}`}>
        {tasks.map((t) => <Card key={t.id} task={t} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { has } = usePermission();
  const canCreate = has('task:create');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep-link support: /dashboard/tasks?task=<id> opens that task's drawer. The
  // drawer fetches the task by id directly, so it works for any task regardless
  // of the board's selected project. Reused by Inbox, AI source links, ⌘K, and
  // the /dashboard/tasks/[id] route. Seed the open task from the URL in the
  // initializer so a hard load / refresh / direct open opens the drawer too (not
  // just client-side navigations); the effect keeps it in sync on later nav.
  const deepLinkTask = searchParams.get('task');
  const [openTaskId, setOpenTaskId] = useState<string | null>(deepLinkTask);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync drawer to the ?task= deep link when it changes
    if (deepLinkTask) setOpenTaskId(deepLinkTask);
  }, [deepLinkTask]);

  const closeDrawer = useCallback(() => {
    setOpenTaskId(null);
    if (searchParams.get('task')) router.replace('/dashboard/tasks');
  }, [router, searchParams]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    fetch('/api/v1/projects').then((r) => r.json()).then((j) => {
      const rows: Project[] = Array.isArray(j?.data) ? j.data : [];
      setProjects(rows);
      if (rows[0]) setProjectId(rows[0].id);
    }).catch(() => { /* network error – ignore, user can reload */ });
  }, []);

  const loadTasks = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/v1/tasks?projectId=${projectId}`).then((r) => r.json()).then((j) => {
      setTasks(Array.isArray(j?.data) ? j.data : []);
    }).catch(() => { /* network error – ignore, user can reload */ });
  }, [projectId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useBoardRealtime(projectId, loadTasks);

  const byColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const c of COLUMNS) map[c.key] = [];
    for (const t of tasks) (map[t.status] ??= []).push(t);
    return map;
  }, [tasks]);

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const newStatus = e.over ? String(e.over.id) : null;
    if (!newStatus) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    // optimistic
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    const res = await fetch(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) loadTasks(); // revert via reload on failure
  }

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;
  const activeProject = projects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-64">
          <Select value={projectId ?? ''} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canCreate && projectId && (
          <button data-testid="create-task-button" onClick={() => setCreating(true)} className="h-9 px-4 bg-foreground text-background text-xs font-mono uppercase tracking-widest">+ New Task</button>
        )}
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground ml-auto">
          Live · {tasks.length} tasks
        </span>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div data-testid="kanban-board-scroll-container" className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
          {COLUMNS.map((c) => (
            <Column key={c.key} col={c} tasks={byColumn[c.key] ?? []} onOpen={setOpenTaskId} />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="border border-foreground bg-background p-3 w-64 shadow-lg">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{activeTask.task_key}</div>
              <div className="text-sm">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {openTaskId && <TaskDrawer taskId={openTaskId} onClose={closeDrawer} />}

      {creating && projectId && (
        <CreateTaskModal
          projectId={projectId}
          projectLabel={activeProject ? `${activeProject.code} — ${activeProject.name}` : undefined}
          onClose={() => setCreating(false)}
          onCreated={loadTasks}
        />
      )}
    </div>
  );
}
