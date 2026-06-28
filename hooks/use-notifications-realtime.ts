'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Subscribe to new notifications for the current member. */
export function useNotificationsRealtime(memberId: string | null, onChange: () => void) {
  useEffect(() => {
    if (!memberId) return;
    const supabase = createClient();
    // Unique topic per subscriber: the SSR browser client is a singleton, so
    // multiple components watching the same member would otherwise collide on
    // one channel and fail with "cannot add postgres_changes after subscribe()".
    const channel = supabase
      .channel(`notifications:${memberId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_member_id=eq.${memberId}` },
        () => onChange())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [memberId, onChange]);
}
