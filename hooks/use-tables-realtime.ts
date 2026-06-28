'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribe to change events on a set of tables and invoke `onChange` whenever
 * any of them change. RLS is enforced server-side via the authenticated
 * realtime token, so a subscriber only receives rows from its own org. Used to
 * keep Overview and My Work live without a manual refresh.
 */
export function useTablesRealtime(tables: string[], onChange: () => void) {
  const key = tables.join(',');
  useEffect(() => {
    const supabase = createClient();
    // Unique topic per subscriber (the browser client is a singleton) to avoid
    // "cannot add postgres_changes after subscribe()" collisions.
    let channel = supabase.channel(`tables:${key}:${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => onChange(),
      );
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, onChange]);
}
