'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowLeft, CheckCircle2, Circle, Video, FileText, HelpCircle,
  Volume2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModulePlayer, type CourseModule } from '@/components/learning/module-player';

interface ProgressRow { module_id: string; progress_pct: number; completed: boolean }

const typeIcon = (t: string) => {
  switch ((t || '').toUpperCase()) {
    case 'VIDEO': return <Video className="w-3.5 h-3.5" />;
    case 'AUDIO': return <Volume2 className="w-3.5 h-3.5" />;
    case 'QUIZ': return <HelpCircle className="w-3.5 h-3.5" />;
    default: return <FileText className="w-3.5 h-3.5" />;
  }
};

export default function LearnPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    fetch(`/api/v1/courses/${courseId}`).then((r) => r.json()).then((j) => {
      const c = j?.data;
      setCourse(c || null);
      const mods: CourseModule[] = (c?.course_modules || c?.modules || [])
        .slice()
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setModules(mods);
      setActiveId((prev) => prev ?? mods[0]?.id ?? null);
    });
    fetch(`/api/v1/courses/${courseId}/progress`).then((r) => r.json()).then((j) => {
      const rows: ProgressRow[] = j?.data?.progress || [];
      const map: Record<string, ProgressRow> = {};
      rows.forEach((r) => { map[r.module_id] = r; });
      setProgress(map);
      // Trainers and admins have no trainee record, so the progress endpoint
      // 403s for them. That is not an error here — they can still preview the
      // material, they just have nothing to record against.
      if (j?.error) setNotice(j.error);
    });
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const active = modules.find((m) => m.id === activeId) || null;
  const activeIndex = modules.findIndex((m) => m.id === activeId);

  // The player fires on every timeupdate (~4/s). Persisting each one would be
  // hundreds of writes per lesson, so keep the latest value and flush on a
  // timer, plus immediately at 100% so completion is never lost to a tab close.
  const pendingRef = useRef<{ moduleId: string; pct: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    fetch(`/api/v1/courses/${courseId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_id: pending.moduleId, progress_pct: pending.pct }),
    }).then((r) => r.json()).then((j) => {
      if (j?.data) {
        setProgress((p) => ({
          ...p,
          [pending.moduleId]: {
            module_id: pending.moduleId,
            progress_pct: pending.pct,
            completed: pending.pct >= 100,
          },
        }));
      }
    }).catch(() => {
      // Offline: lib/offline/sync.ts owns replay. Losing a few percent of
      // watch position is not worth surfacing an error over.
    });
  }, [courseId]);

  const handleProgress = useCallback((pct: number) => {
    if (!activeId) return;
    pendingRef.current = { moduleId: activeId, pct };
    if (pct >= 100) { if (timerRef.current) clearTimeout(timerRef.current); flush(); return; }
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => { timerRef.current = null; flush(); }, 5000);
  }, [activeId, flush]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); flush(); }, [flush]);

  const done = modules.filter((m) => progress[m.id]?.completed).length;
  const overall = modules.length ? Math.round((done / modules.length) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="border-b border-border pb-5"
      >
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Course catalog
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
          Learning_LMS // Player
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter uppercase text-foreground">
          {course?.title || 'Course'}
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 max-w-sm bg-surface rounded-full overflow-hidden border border-border">
            <div className="h-full bg-accent transition-all" style={{ width: `${overall}%` }} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {done} / {modules.length} complete
          </span>
        </div>
      </motion.div>

      {notice && (
        <div className="border border-border bg-surface/60 rounded px-4 py-3 font-mono text-[11px] text-muted-foreground">
          {notice} — you can still preview every module.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Module list */}
        <aside className="space-y-1 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-2">
          {modules.map((m, i) => {
            const p = progress[m.id];
            const isActive = m.id === activeId;
            return (
              <button
                key={m.id}
                onClick={() => setActiveId(m.id)}
                data-native-tap
                className={`w-full text-left px-3 py-3 rounded border transition-colors flex items-start gap-3 ${
                  isActive ? 'border-foreground bg-surface' : 'border-border hover:border-foreground'
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${p?.completed ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {p?.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    {typeIcon(m.type)} {String(i + 1).padStart(2, '0')} · {m.type}
                  </span>
                  <span className="block text-sm text-foreground truncate">{m.title}</span>
                  {p && !p.completed && p.progress_pct > 0 && (
                    <span className="block mt-1 h-0.5 bg-surface rounded-full overflow-hidden">
                      <span className="block h-full bg-accent" style={{ width: `${p.progress_pct}%` }} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {modules.length === 0 && (
            <div className="text-center py-12 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              This course has no modules yet.
            </div>
          )}
        </aside>

        {/* Player */}
        <section className="min-w-0 space-y-4">
          {active ? (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{active.title}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                    {active.type}
                    {active.duration_minutes ? ` · ${active.duration_minutes} min` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" data-native-tap
                    disabled={activeIndex <= 0}
                    onClick={() => setActiveId(modules[activeIndex - 1]?.id ?? null)}
                    className="rounded font-mono text-[10px] uppercase tracking-widest"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                  </Button>
                  <Button
                    variant="outline" data-native-tap
                    disabled={activeIndex < 0 || activeIndex >= modules.length - 1}
                    onClick={() => setActiveId(modules[activeIndex + 1]?.id ?? null)}
                    className="rounded font-mono text-[10px] uppercase tracking-widest"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>

              <ModulePlayer
                key={active.id}
                module={active}
                initialPct={progress[active.id]?.progress_pct ?? 0}
                onProgress={handleProgress}
              />
            </>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-border rounded bg-surface/40 font-mono text-xs text-muted-foreground">
              Select a module to begin.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
