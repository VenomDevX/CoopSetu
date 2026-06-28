'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationsRealtime } from '@/hooks/use-notifications-realtime';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    fetch('/api/v1/notifications').then((r) => r.json()).then((j) => {
      setItems(j?.data?.items ?? []);
      setUnread(j?.data?.unread ?? 0);
    });
  }, []);

  useEffect(() => {
    fetch('/api/v1/organizations/current').then((r) => r.json()).then((j) => {
      const mem = j?.data?.membership;
      if (mem) setMemberId(mem.memberId);
    });
    load();
  }, [load]);

  useNotificationsRealtime(memberId, load);

  async function markAll() {
    await fetch('/api/v1/notifications/mark-all-read', { method: 'POST' });
    load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-none transition-colors border border-transparent hover:border-border"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-foreground text-background text-[9px] font-mono flex items-center justify-center rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-background border border-border z-50 shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="font-mono text-[10px] uppercase tracking-widest">Inbox · {unread} unread</span>
            <button onClick={markAll} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
              Mark all read
            </button>
          </div>
          {items.length === 0 && <div className="p-4 text-xs font-mono text-muted-foreground">No notifications.</div>}
          {items.map((n) => (
            <div key={n.id} className={`p-3 border-b border-border ${n.read_at ? 'opacity-60' : 'bg-surface'}`}>
              <div className="text-xs font-bold">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</div>}
              <div className="font-mono text-[9px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
