'use client';

import { Suspense } from 'react';
import { ChevronRight , CheckSquare} from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';

export default function TasksPage() {
  return (
    <WorkspaceDataLayout className="space-y-6 animate-in fade-in duration-500">
      <div className="flex-shrink-0">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <span>Delivery</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">Tasks</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
          <CheckSquare className="w-8 h-8" />
          Task Board
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
          Live Kanban — drag to change status, updates sync across sessions.
        </p>
      </div>
      <Suspense fallback={null}>
        <KanbanBoard />
      </Suspense>
    </WorkspaceDataLayout>
  );
}
