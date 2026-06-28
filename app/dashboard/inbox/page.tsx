'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationsRealtime } from '@/hooks/use-notifications-realtime';
import { AskAiButton } from '@/components/ai/ask-ai-button';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';
import { DataViewport } from '@/components/layout/data-viewport';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  CheckCircle2,
  Settings,
  Inbox as InboxIcon,
  Bell,
  AtSign,
  FileSignature,
  CheckSquare,
  GitPullRequest,
  Rocket,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Terminal,
  Search,
  Filter,
  ListOrdered,
  MoreHorizontal,
  Eye,
  Clock,
  ArrowUpRight,
  AlertCircle,
  Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  categoryOf, NOTIFICATION_CATEGORIES,
  type NotificationCategory, type NotificationCounts,
} from '@/lib/constants/notification-categories';

type Notification = {
  id: string;
  read: boolean;
  type: string;
  category: NotificationCategory;
  title: string;
  description: string;
  project: string;
  reference: string;
  sender: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  entityId: string | null;
  entityType: string | null;
  commentId: string | null;
};

const TYPE_MAP: Record<string, string> = {
  TASK_MENTIONED: 'mention', TASK_COMMENTED: 'mention',
  APPROVAL_REQUESTED: 'approval', APPROVAL_DECIDED: 'approval',
  RELEASE_ALERT: 'approval', INCIDENT_ASSIGNED: 'incident',
  BUILD_FAILED: 'pr', SECURITY_ALERT: 'incident', AI_RECOMMENDATION: 'ai',
};

const EMPTY_COUNTS: NotificationCounts = {
  all: 0, unread: 0, mentions: 0, approvals: 0, task_updates: 0, pull_requests: 0,
  release_alerts: 0, incident_alerts: 0, qa_security: 0, ai: 0, system: 0,
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}


function mapNotification(r: any): Notification {
  return {
    id: r.id,
    read: !!r.read_at,
    type: TYPE_MAP[r.type] ?? 'system',
    category: categoryOf(r.type),
    title: r.title,
    description: r.body ?? '',
    project: '',
    reference: r.entity_type ?? '',
    sender: r.actor ? 'Teammate' : 'System',
    timestamp: relTime(r.created_at),
    priority: r.type?.includes('SECURITY') || r.type?.includes('INCIDENT') ? 'critical'
      : r.type?.includes('APPROVAL') || r.type?.includes('RELEASE') ? 'high' : 'medium',
    entityId: r.entity_id ?? null,
    entityType: r.entity_type ?? null,
    commentId: r.metadata?.comment_id ?? null,
  };
}

// Category rail config. Counts are injected at render time from the same
// organization-scoped notifications query that feeds the list (never hardcoded).
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: InboxIcon, unread: Bell, mentions: AtSign, approvals: FileSignature,
  task_updates: CheckSquare, pull_requests: GitPullRequest, release_alerts: Rocket,
  incident_alerts: AlertTriangle, qa_security: ShieldCheck, ai: Sparkles, system: Terminal,
};

const CATEGORY_RAIL: { key: string; name: string }[] = [
  { key: 'all', name: 'All' },
  { key: 'unread', name: 'Unread' },
  ...NOTIFICATION_CATEGORIES.map((c) => ({ key: c.key, name: c.label })),
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'mention': return <AtSign className="w-4 h-4 text-blue-500" />;
    case 'approval': return <FileSignature className="w-4 h-4 text-orange-500" />;
    case 'incident': return <AlertTriangle className="w-4 h-4 text-destructive" />;
    case 'pr': return <GitPullRequest className="w-4 h-4 text-emerald-500" />;
    case 'ai': return <Sparkles className="w-4 h-4 text-accent" />;
    default: return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'border-destructive text-destructive bg-destructive/10';
    case 'high': return 'border-orange-500/50 text-orange-500 bg-orange-500/10';
    case 'medium': return 'border-border text-foreground bg-surface';
    case 'low': return 'border-border text-muted-foreground bg-surface';
    default: return 'border-border text-foreground bg-surface';
  }
};

export default function InboxPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY_COUNTS);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [selectedNotifId, setSelectedNotifId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/v1/notifications')
      .then((r) => r.json())
      .then((j) => {
        const items = (j?.data?.items ?? []).map(mapNotification);
        setNotifications(items);
        setCounts(j?.data?.counts ?? EMPTY_COUNTS);
        setSelectedNotifId((prev) => prev ?? items[0]?.id ?? null);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetch('/api/v1/organizations/current').then((r) => r.json()).then((j) => {
      if (j?.data?.membership) setMemberId(j.data.membership.memberId);
    });
    load();
  }, [load]);

  useNotificationsRealtime(memberId, load);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/v1/notifications/mark-all-read', { method: 'POST' });
      if (res.ok) load();
    } catch { }
  };

  const handleUpdate = async (id: string, patch: { read?: boolean; archived?: boolean; snoozed_until?: string | null }) => {
    // optimistic update
    setNotifications(prev => prev.map(n => {
      if (n.id !== id) return n;
      if (patch.read !== undefined) return { ...n, read: patch.read };
      return n;
    }));
    try {
      const res = await fetch(`/api/v1/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (res.ok) load();
    } catch { }
  };

  const handleSelectNotif = (id: string) => {
    setSelectedNotifId(id);
    setActionError(null);
    const n = notifications.find(x => x.id === id);
    if (n && !n.read) handleUpdate(id, { read: true });
  };

  // Deep-link a notification to the entity it references. Tasks open the task
  // drawer via the shared ?task= primitive; incidents/approvals/releases route
  // to their surfaces. Marks the notification read on navigate.
  const handleOpenItem = (n: Notification) => {
    if (!n.read) handleUpdate(n.id, { read: true });
    const id = n.entityId;
    switch (n.entityType) {
      case 'task':
        if (id) router.push(`/dashboard/tasks?task=${id}`);
        break;
      case 'incident':
        if (id) router.push(`/dashboard/incidents/${id}`);
        break;
      case 'approval_request':
      case 'release':
        router.push('/dashboard/qa-security');
        break;
      default:
        setActionError('This notification has no linked item to open.');
    }
  };

  // Approve / reject an approval_request straight from the inbox. Never fakes
  // success — surfaces the API error (e.g. 403) inline.
  const handleDecide = async (n: Notification, decision: 'APPROVED' | 'REJECTED') => {
    if (n.entityType !== 'approval_request' || !n.entityId) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/approvals/${n.entityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        handleUpdate(n.id, { read: true });
        load();
      } else {
        setActionError(j?.error?.message ?? `Could not ${decision.toLowerCase()} this request.`);
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const visibleNotifications = notifications.filter((n) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'unread') return !n.read;
    return n.category === activeCategory;
  });

  const selectedNotif = notifications.find(n => n.id === selectedNotifId);

  return (
    <WorkspaceDataLayout className="animate-in fade-in duration-500 space-y-6 flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Overview</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Inbox</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <InboxIcon className="w-8 h-8" />
            Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Track mentions, approvals, delivery alerts, incidents, and important updates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleMarkAllRead} variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Mark All Read
          </Button>
          <Button variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
            <Settings className="w-4 h-4" />
            Configure
          </Button>
          <AskAiButton />
        </div>
      </div>

      {/* Main Layout - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

        {/* Left Column - Categories */}
        <div className="lg:col-span-2 flex flex-col gap-1 lg:overflow-y-auto pr-2 scrollbar-none">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 pl-2">Categories</div>
          {CATEGORY_RAIL.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.key] ?? InboxIcon;
            const count = counts[cat.key as keyof NotificationCounts] ?? 0;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center justify-between w-full p-2 text-xs font-mono uppercase tracking-wider transition-colors ${activeCategory === cat.key
                    ? 'bg-foreground text-background font-bold'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span className="truncate">{cat.name}</span>
                </div>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 text-[9px] ${activeCategory === cat.key ? 'bg-background text-foreground' : 'bg-surface border border-border'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Middle Column - Notification List */}
        <DataViewport className="lg:col-span-6 border-0 lg:border border-border">

          {/* Top Tools */}
          <div className="p-3 border-b border-border bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="SEARCH INBOX..." className="w-full h-8 pl-8 pr-3 bg-background border border-border text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors" />
              </div>
              <Button variant="outline" size="sm" className="h-8 px-3 rounded-none text-[10px] font-mono uppercase border-border">
                <Filter className="w-3 h-3 mr-2" /> Filter
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 rounded-none text-[10px] font-mono uppercase border-border">
                <ListOrdered className="w-3 h-3 mr-2" /> Sort
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-2 rounded-none border-border">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {visibleNotifications.length > 0 ? (
              <div className="divide-y divide-border">
                {visibleNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleSelectNotif(notif.id)}
                    className={`p-4 cursor-pointer transition-colors relative group ${selectedNotifId === notif.id ? 'bg-surface-hover border-l-2 border-l-foreground' : 'hover:bg-surface-hover border-l-2 border-l-transparent'
                      } ${!notif.read ? 'bg-background' : 'bg-surface/30 opacity-70'}`}
                  >
                    {!notif.read && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent animate-pulse" />
                    )}
                    <div className="flex items-start gap-4 pr-6">
                      <div className="mt-1 flex-shrink-0 bg-surface border border-border w-8 h-8 flex items-center justify-center">
                        {getTypeIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-sm truncate">{notif.title}</span>
                          <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${getPriorityColor(notif.priority)}`}>
                            {notif.priority}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                          {notif.description}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] font-mono uppercase text-muted-foreground">
                          <span className="text-foreground">{notif.sender}</span>
                          <span>•</span>
                          <span>{notif.project}</span>
                          <span>•</span>
                          <span className="border border-border px-1 bg-surface">{notif.reference}</span>
                          <span>•</span>
                          <span>{notif.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-mono text-sm uppercase tracking-widest font-bold mb-2">
                  {counts.all === 0 ? 'Inbox Zero' : 'Nothing Here'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {counts.all === 0
                    ? 'You are all caught up. No notifications require action.'
                    : 'No notifications in this category.'}
                </p>
              </div>
            )}
          </div>
        </DataViewport>

        {/* Right Column - Detail Panel */}
        <DataViewport className="lg:col-span-4 border-0 lg:border border-border">
          {selectedNotif ? (
            <>
              {/* Detail Header */}
              <div className="p-4 border-b border-border bg-surface flex flex-col gap-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-background border border-border w-10 h-10 flex items-center justify-center">
                      {getTypeIcon(selectedNotif.type)}
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                        {selectedNotif.project} / {selectedNotif.reference}
                      </div>
                      <h2 className="text-sm font-bold leading-tight">{selectedNotif.title}</h2>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  {selectedNotif.entityType === 'approval_request' ? (
                    <>
                      <Button onClick={() => handleDecide(selectedNotif, 'APPROVED')} disabled={actionBusy} size="sm" className="h-8 rounded-none text-[10px] font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 flex-1 disabled:opacity-50">
                        Approve
                      </Button>
                      <Button onClick={() => handleDecide(selectedNotif, 'REJECTED')} disabled={actionBusy} variant="outline" size="sm" className="h-8 rounded-none text-[10px] font-mono uppercase tracking-widest border-destructive text-destructive hover:bg-destructive hover:text-background flex-1 disabled:opacity-50">
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => handleOpenItem(selectedNotif)} disabled={!selectedNotif.entityType} size="sm" className="h-8 rounded-none text-[10px] font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 flex-1 disabled:opacity-50" title={selectedNotif.entityType ? undefined : 'No linked item'}>
                      Open Item
                    </Button>
                  )}
                  <Button onClick={() => handleUpdate(selectedNotif.id, { snoozed_until: new Date(Date.now() + 86400000).toISOString() })} variant="outline" size="sm" className="h-8 px-3 rounded-none border-border hover:bg-surface-hover" title="Snooze 24h">
                    <Clock className="w-4 h-4" />
                  </Button>
                  <Button onClick={() => handleUpdate(selectedNotif.id, { archived: true })} variant="outline" size="sm" className="h-8 px-3 rounded-none border-border hover:bg-surface-hover" title="Archive">
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
                {actionError && (
                  <div className="text-[10px] font-mono uppercase tracking-widest text-destructive border border-destructive/30 bg-destructive/10 px-2 py-1">
                    {actionError}
                  </div>
                )}
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-0">

                {/* Message / Description content */}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center text-xs font-mono font-bold">
                      {selectedNotif.sender.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold">{selectedNotif.sender}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{selectedNotif.timestamp}</div>
                    </div>
                  </div>
                  <div className="text-sm leading-relaxed border-l-2 border-border pl-4 py-1 text-foreground/90">
                    {selectedNotif.description}
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono uppercase tracking-widest">
              Select an item to view details
            </div>
          )}
        </DataViewport>

      </div>
    </WorkspaceDataLayout>
  );
}
