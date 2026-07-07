'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useDragControls } from 'motion/react';
import { Bell } from 'lucide-react';
import { useNotificationsRealtime } from '@/hooks/use-notifications-realtime';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

const POSITION_KEY = 'notification-bell-corner';
const MARGIN = 20;
const SIZE = 40;
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function cornerPoint(corner: string) {
  return {
    x: corner.endsWith('left') ? MARGIN : window.innerWidth - SIZE - MARGIN,
    y: corner.startsWith('top') ? MARGIN : window.innerHeight - SIZE - MARGIN,
  };
}

function nearestCorner(p: { x: number; y: number }) {
  const v = p.y + SIZE / 2 < window.innerHeight / 2 ? 'top' : 'bottom';
  const h = p.x + SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right';
  return `${v}-${h}`;
}

export function NotificationBell() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // Panel opens toward the side of the screen with the most room.
  const [panelSide, setPanelSide] = useState<{ v: 'top' | 'bottom'; h: 'left' | 'right' }>({ v: 'top', h: 'left' });
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);
  const dragControls = useDragControls();

  // Restore saved corner (or default bottom-right) after mount — needs window size.
  useEffect(() => {
    let corner = 'bottom-right';
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved && CORNERS.includes(saved)) corner = saved;
    } catch { /* corrupted value — fall back to default */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(cornerPoint(corner));

    const onResize = () => setPosition((p) => (p ? cornerPoint(nearestCorner(p)) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function markAll() {
    await fetch('/api/v1/notifications/mark-all-read', { method: 'POST' });
    load();
  }

  function toggleOpen() {
    // A drag also fires a click on release — ignore it.
    if (draggingRef.current) return;
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelSide({
        v: rect.top > window.innerHeight / 2 ? 'top' : 'bottom',
        h: rect.left > window.innerWidth / 2 ? 'left' : 'right',
      });
    }
    setOpen((o) => !o);
  }

  if (!position) return null;

  return (
    <motion.div
      ref={containerRef}
      className="fixed z-[80]"
      style={{ left: 0, top: 0, touchAction: 'none' }}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        draggingRef.current = true;
        setOpen(false);
      }}
      onDragEnd={(_, info) => {
        // Snap to the nearest corner from wherever it was dropped.
        setPosition((p) => {
          if (!p) return p;
          const corner = nearestCorner({ x: p.x + info.offset.x, y: p.y + info.offset.y });
          try { localStorage.setItem(POSITION_KEY, corner); } catch { /* storage unavailable */ }
          return cornerPoint(corner);
        });
        // Let the synthetic click from this release be ignored, then re-enable.
        setTimeout(() => { draggingRef.current = false; }, 0);
      }}
    >
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        onPointerDown={(e) => dragControls.start(e)}
        aria-label="Notifications"
        className="relative w-10 h-10 flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing bg-background text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 shadow-lg shadow-black/20 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-accent text-white text-[9px] font-mono flex items-center justify-center rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className={`absolute w-80 max-h-96 overflow-y-auto bg-background border border-border z-50 shadow-2xl ${
            panelSide.v === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${panelSide.h === 'left' ? 'right-0' : 'left-0'}`}
        >
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
    </motion.div>
  );
}
