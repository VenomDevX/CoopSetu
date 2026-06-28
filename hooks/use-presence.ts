'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PresenceUser {
  memberId: string;
  name: string;
}

/** Track who is currently viewing a given channel (task/project). */
export function usePresence(channelName: string | null, self: PresenceUser | null) {
  const [present, setPresent] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!channelName || !self) return;
    const supabase = createClient();
    const channel = supabase.channel(channelName, { config: { presence: { key: self.memberId } } });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users = Object.values(state).flat().map((u) => ({ memberId: u.memberId, name: u.name }));
        setPresent(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(self);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [channelName, self]);

  return present;
}
