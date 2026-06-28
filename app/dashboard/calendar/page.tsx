'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Bot,
  Search,
  Filter,
  Layers,
  Clock,
  Rocket,
  Flag,
  ShieldCheck,
  User,
  Users,
  AlertTriangle,
  X,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';

type EventType = 'task' | 'release' | 'milestone' | 'meeting' | 'compliance' | 'leave' | 'incident';

type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  type: EventType;
  priority?: 'P1' | 'P2' | 'P3';
  project?: string;
};

interface DirectoryMember {
  id: string;
  name: string;
  job_title: string | null;
}

// Builds calendar events from real task due dates (full Date, any month).

function buildEvents(tasks: any[]): CalendarEvent[] {
  return tasks
    .filter((t) => t.due_date)
    .map((t) => ({
      id: t.id,
      title: `${t.task_key}: ${t.title}`,
      date: new Date(t.due_date),
      type: 'task' as EventType,
      priority: (t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'P1' : 'P2') as 'P1' | 'P2',
      project: t.project?.code,
    }));
}

const LAYERS = [
  { name: 'My Tasks', icon: CheckSquare },
  { name: 'Team Tasks', icon: Users },
  { name: 'Sprint Dates', icon: Flag },
  { name: 'Releases', icon: Rocket },
  { name: 'Project Milestones', icon: Flag },
  { name: 'Meetings', icon: Clock },
  { name: 'Security Reviews', icon: ShieldCheck },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const getEventStyles = (type: EventType) => {
  switch (type) {
    case 'task': return 'border-border bg-surface hover:border-foreground';
    case 'release': return 'border-foreground bg-foreground text-background';
    case 'milestone': return 'border-border bg-surface font-bold border-l-2 border-l-foreground';
    case 'meeting': return 'border-border bg-background border-dashed';
    case 'compliance': return 'border-border bg-surface border-l-2 border-l-accent';
    case 'leave': return 'border-border bg-surface/50 text-muted-foreground italic';
    case 'incident': return 'border-destructive/30 bg-destructive/10 text-destructive';
    default: return 'border-border bg-surface';
  }
};

const getEventIcon = (type: EventType, className: string = 'w-3 h-3') => {
  switch (type) {
    case 'release': return <Rocket className={className} />;
    case 'milestone': return <Flag className={className} />;
    case 'meeting': return <Clock className={className} />;
    case 'compliance': return <ShieldCheck className={className} />;
    case 'leave': return <User className={className} />;
    case 'incident': return <AlertTriangle className={className} />;
    case 'task': return <CheckSquare className={className} />;
    default: return null;
  }
};

const getPrioritySymbol = (priority?: string) => {
  if (priority === 'P1') return '!!';
  if (priority === 'P2') return '!';
  return '';
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function CalendarPage() {
  const [view, setView] = useState('Month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [activeLayers, setActiveLayers] = useState<string[]>(LAYERS.map((l) => l.name));
  const [search, setSearch] = useState('');
  // First day of the month currently displayed; defaults to the real current month.
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  useEffect(() => {
    let active = true;
    fetch('/api/v1/tasks')
      .then((r) => r.json())
      .then((j) => { if (active) setEvents(buildEvents(Array.isArray(j?.data) ? j.data : [])); })
      .catch(() => { });
    fetch('/api/v1/employees')
      .then((r) => r.json())
      .then((j) => {
        if (!active || !Array.isArray(j?.data)) return;
        setMembers(j.data.map((m: { id: string; profile: { full_name?: string; email?: string; job_title?: string } | { full_name?: string; email?: string; job_title?: string }[] | null }) => {
          const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          return { id: m.id, name: p?.full_name ?? p?.email ?? 'Member', job_title: p?.job_title ?? null };
        }));
      })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  const today = useMemo(() => new Date(), []);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  // Events for the displayed month, honoring the search filter.
  const monthEvents = useMemo(() => events.filter((e) =>
    e.date.getMonth() === month && e.date.getFullYear() === year &&
    (!search || e.title.toLowerCase().includes(search.toLowerCase())),
  ), [events, month, year, search]);

  // Build a Monday-first grid that aligns real weekdays.
  const gridCells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
    const offset = (firstDow + 6) % 7; // shift so Monday=0
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const day = i - offset + 1;
      return day > 0 && day <= daysInMonth ? day : null;
    });
  }, [year, month]);

  // Real "upcoming" — next 7 days from today, sorted.
  const upcoming = useMemo(() => {
    const end = new Date(today); end.setDate(end.getDate() + 7);
    return events
      .filter((e) => e.date >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) && e.date <= end)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [events, today]);

  // Honest, derived schedule insights for the displayed month (no fabricated data).
  const insights = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const e of monthEvents) byDay.set(e.date.getDate(), (byDay.get(e.date.getDate()) ?? 0) + 1);
    let busiestDay = 0; let busiestCount = 0;
    for (const [d, c] of byDay) if (c > busiestCount) { busiestCount = c; busiestDay = d; }
    const highPriority = monthEvents.filter((e) => e.priority === 'P1').length;
    return { total: monthEvents.length, busiestDay, busiestCount, highPriority };
  }, [monthEvents]);

  const goMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));
  const goToday = () => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); };
  const toggleLayer = (name: string) =>
    setActiveLayers((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);

  return (
    <WorkspaceDataLayout className="flex flex-col animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Overview</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Calendar</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <CalendarIcon className="w-8 h-8" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Task deadlines, releases, and delivery milestones across the org.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <Plus className="w-4 h-4" />
            Add Deadline
          </Button>
          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-accent gap-2 disabled:opacity-40">
            <Bot className="w-4 h-4" />
            Ask Handoff AI
          </Button>
        </div>
      </div>

      {/* Top Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 p-2 border border-border bg-surface-hover flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button onClick={goToday} variant="outline" size="sm" className="h-8 px-3 rounded-none text-xs font-mono uppercase tracking-widest border-border bg-background">
            Today
          </Button>
          <div className="flex items-center gap-1 bg-background border border-border px-2 h-8">
            <button onClick={() => goMonth(-1)} className="p-1 hover:bg-surface"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-mono text-xs uppercase px-2 font-bold min-w-[130px] text-center">{monthLabel}</span>
            <button onClick={() => goMonth(1)} className="p-1 hover:bg-surface"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-border bg-background">
            {['Month', 'Agenda'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`h-8 px-4 text-[10px] font-mono uppercase tracking-widest transition-colors ${view === v ? 'bg-foreground text-background font-bold' : 'hover:bg-surface text-muted-foreground hover:text-foreground'
                  }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 md:justify-end">
          <div className="relative w-48">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              type="text" placeholder="SEARCH EVENTS..."
              className="w-full h-8 pl-7 pr-3 bg-background border border-border text-[10px] font-mono uppercase focus:outline-none focus:border-foreground" />
          </div>
          <Button variant="outline" disabled title="Not available yet" size="sm" className="h-8 px-3 rounded-none text-[10px] font-mono uppercase border-border bg-background disabled:opacity-40">
            <Filter className="w-3 h-3 mr-2" /> Filter
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">

        {/* Left Column - Layers */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto pr-2 scrollbar-none">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Layers className="w-3 h-3" /> Calendar Layers
          </div>
          <div className="space-y-1">
            {LAYERS.map((layer) => {
              const on = activeLayers.includes(layer.name);
              return (
                <button key={layer.name} onClick={() => toggleLayer(layer.name)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-surface-hover cursor-pointer group text-left">
                  <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${on ? 'border-foreground bg-foreground' : 'border-border bg-background group-hover:border-foreground'}`}>
                    {on && <div className="w-1.5 h-1.5 bg-background" />}
                  </div>
                  <layer.icon className="w-3 h-3 text-muted-foreground" />
                  <span className={`text-xs font-mono uppercase tracking-wider ${on ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {layer.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle Column - Calendar Grid */}
        {view === 'Month' ? (
          <div className="lg:col-span-7 flex flex-col border border-border bg-background min-h-0">
            <div className="grid grid-cols-7 border-b border-border bg-surface-hover">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="p-2 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 min-h-0 bg-surface/50" style={{ gridAutoRows: 'minmax(0, 1fr)' }}>
              {gridCells.map((day, i) => {
                const isToday = day != null && sameDay(new Date(year, month, day), today);
                const dayEvents = day == null ? [] : monthEvents.filter((e) => e.date.getDate() === day);
                return (
                  <div key={i} className="border-r border-b border-border relative bg-background p-1 flex flex-col gap-1 min-h-0 overflow-hidden">
                    {day && (
                      <>
                        <div className={`text-[10px] font-mono text-right p-1 ${isToday ? 'text-background bg-foreground font-bold w-5 h-5 ml-auto flex items-center justify-center rounded-full' : 'text-muted-foreground'}`}>
                          {day}
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-none">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`px-1.5 py-1 text-[9px] font-mono uppercase border cursor-pointer truncate flex items-center gap-1.5 transition-opacity hover:opacity-80 ${getEventStyles(event.type)}`}
                            >
                              {getEventIcon(event.type)}
                              {event.priority && <span className="font-bold">{getPrioritySymbol(event.priority)}</span>}
                              <span className="truncate flex-1">{event.title}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Agenda view — flat chronological list of the displayed month's events */
          <div className="lg:col-span-7 flex flex-col border border-border bg-background min-h-0 overflow-y-auto scrollbar-thin">
            {monthEvents.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-muted-foreground">No events in {monthLabel}.</div>
            ) : (
              <div className="divide-y divide-border">
                {[...monthEvents].sort((a, b) => a.date.getTime() - b.date.getTime()).map((event) => (
                  <button key={event.id} onClick={() => setSelectedEvent(event)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-surface-hover text-left">
                    <div className="font-mono text-[10px] text-muted-foreground w-14 flex-shrink-0">
                      {MONTH_NAMES[event.date.getMonth()].slice(0, 3)} {event.date.getDate()}
                    </div>
                    <div className={`w-6 h-6 flex items-center justify-center border flex-shrink-0 ${getEventStyles(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <span className="text-xs truncate flex-1">{event.title}</span>
                    {event.priority && <span className="font-mono text-[10px] text-muted-foreground">{event.priority}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Column - Insights */}
        <div className="lg:col-span-3 flex flex-col gap-6 min-h-0 overflow-y-auto pr-2 scrollbar-none">

          {/* Schedule Insights — derived from real events for the displayed month */}
          <div className="border border-border bg-background relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-bl-full pointer-events-none" />
            <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent" />
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Schedule Insights</h3>
              </div>
            </div>
            <div className="p-4 space-y-4 text-sm leading-relaxed text-muted-foreground font-light">
              {insights.total === 0 ? (
                <p className="text-xs">No deadlines scheduled in {monthLabel}.</p>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-foreground">{insights.total} deadline{insights.total === 1 ? '' : 's'}</span>
                      <p className="text-xs mt-1">scheduled in {monthLabel}{insights.highPriority > 0 ? `, ${insights.highPriority} high-priority` : ''}.</p>
                    </div>
                  </div>
                  {insights.busiestCount > 1 && (
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-foreground">Busiest day</span>
                        <p className="text-xs mt-1">{MONTH_NAMES[month]} {insights.busiestDay} has {insights.busiestCount} items due.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Upcoming — real events in the next 7 days */}
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-foreground" /> Upcoming This Week
              </h3>
            </div>
            <div className="divide-y divide-border">
              {upcoming.length === 0 ? (
                <div className="p-4 text-xs font-mono text-muted-foreground">Nothing due in the next 7 days.</div>
              ) : upcoming.map((event) => (
                <button key={event.id} className="w-full p-3 flex items-start gap-3 hover:bg-surface-hover text-left" onClick={() => setSelectedEvent(event)}>
                  <div className={`mt-0.5 w-6 h-6 flex items-center justify-center border ${getEventStyles(event.type)}`}>
                    {getEventIcon(event.type, 'w-3 h-3')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{event.title}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-widest">
                      {MONTH_NAMES[event.date.getMonth()].slice(0, 3)} {event.date.getDate()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Team — real org members (availability tracking not yet implemented) */}
          <div className="border border-border bg-background">
            <div className="p-4 border-b border-border bg-surface-hover">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                <Users className="w-4 h-4" /> Team
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {members.slice(0, 6).map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{m.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{m.job_title ?? '—'}</div>
                  </div>
                </div>
              ))}
              {members.length === 0 && <p className="text-xs font-mono text-muted-foreground">No members.</p>}
            </div>
          </div>

        </div>
      </div>

      {/* Event Detail Drawer */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setSelectedEvent(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full md:w-[500px] h-full bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface-hover flex-shrink-0">
                <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${getEventStyles(selectedEvent.type)} flex items-center gap-2`}>
                  {getEventIcon(selectedEvent.type)}
                  {selectedEvent.type}
                </span>
                <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-surface border border-transparent hover:border-border transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold mb-4 tracking-tight">{selectedEvent.title}</h2>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Date</div>
                      <div>{MONTH_NAMES[selectedEvent.date.getMonth()]} {selectedEvent.date.getDate()}, {selectedEvent.date.getFullYear()}</div>
                    </div>
                    {selectedEvent.priority && (
                      <div>
                        <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Flag className="w-3 h-3" /> Priority</div>
                        <div>{selectedEvent.priority}</div>
                      </div>
                    )}
                    {selectedEvent.project && (
                      <div>
                        <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Layers className="w-3 h-3" /> Project</div>
                        <div>{selectedEvent.project}</div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedEvent.type === 'task' && (
                  <a href={`/dashboard/tasks`} className="inline-flex items-center gap-2 h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest hover:bg-surface">
                    Open in Tasks <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </WorkspaceDataLayout>
  );
}
