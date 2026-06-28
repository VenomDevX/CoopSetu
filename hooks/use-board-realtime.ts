'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { channels } from '@/lib/realtime/channels';

/**
 * Subscribe to task changes for a project. Invokes `onChange` whenever a task
 * row in this project is inserted/updated/deleted. RLS is enforced server-side
 * via the authenticated realtime token.
 */
export function useBoardRealtime(projectId: string | null, onChange: () => void) {
  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    // Unique topic per subscriber (shared singleton client) to avoid
    // "cannot add postgres_changes after subscribe()" collisions.
    const channel = supabase
      .channel(`${channels.project(projectId)}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignees' },
        () => onChange(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, onChange]);
}
