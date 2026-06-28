'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { channels } from '@/lib/realtime/channels';

/** Subscribe to comments + activity + changes for a single task. */
export function useTaskRealtime(taskId: string | null, onChange: () => void) {
  useEffect(() => {
    if (!taskId) return;
    const supabase = createClient();
    // Unique topic per subscriber (shared singleton client) to avoid
    // "cannot add postgres_changes after subscribe()" collisions.
    const channel = supabase
      .channel(`${channels.task(taskId)}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        () => onChange())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_activity', filter: `task_id=eq.${taskId}` },
        () => onChange())
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` },
        () => onChange())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, onChange]);
}
