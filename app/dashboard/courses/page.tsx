'use client';

import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Clock, Users, Search, FileText, Video, HelpCircle, Download, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useTranslations } from 'next-intl';
import { usePermission } from "@/lib/permissions/context";
import { saveModule, deleteModule, listModules, queueProgress, type CachedModule } from "@/lib/offline/db";
import { flushOfflineQueues } from "@/lib/offline/sync";
import { cacheAssetForOffline, uncacheOfflineAsset } from "@/lib/offline/cache-asset";
import { useIsNative } from '@/components/native/native-provider';

interface CourseModule { id: string; title: string; type: string; order_index: number; content_url?: string; content_text?: string; }
interface Course {
  id: string;
  programme_id: string;
  title: string;
  description?: string;
  duration_hours: number;
  order_index: number;
  status: string;
  programmes?: { title: string };
  course_modules?: CourseModule[];
}

export default function CoursesPage() {
  // The native app bar already names this screen, so the page's own <h1> is
  // a duplicate: two h1s on one screen, the second repeating what the sticky
  // bar above it already says. Dropping it in the app reclaims 40px (measured
  // on a Pixel 7) and leaves exactly one h1 on the page.
  const isNative = useIsNative();
  const t = useTranslations('Courses');
  const { hasRole } = usePermission();
  const isTrainee = hasRole('TRAINEE');

  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ programme_id: '', title: '', description: '', duration_hours: 1 });

  const [cachedModules, setCachedModules] = useState<Record<string, CachedModule>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch('/api/v1/courses').then(r => r.json()).then(j => {
      if (j?.data) setCourses(j.data.courses || []);
    });
  }, []);

  const loadCachedModules = useCallback(async () => {
    try {
      const mods = await listModules();
      setCachedModules(Object.fromEntries(mods.map(m => [m.id, m])));
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — offline download UI just stays unavailable.
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isTrainee) loadCachedModules(); }, [isTrainee, loadCachedModules]);

  const handleCreate = async () => {
    await fetch('/api/v1/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ programme_id: '', title: '', description: '', duration_hours: 1 });
    load();
  };

  const handleDownload = async (course: Course, mod: CourseModule) => {
    setDownloadingId(mod.id);
    setDownloadError(prev => { const next = { ...prev }; delete next[mod.id]; return next; });
    try {
      // The course list embed only carries id/title/type/order_index — fetch
      // the full module (content_url/content_text) on demand, only when a
      // trainee actually asks to download it.
      const res = await fetch(`/api/v1/courses/${course.id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to load module content.');
      const fullModule = (j.data?.course_modules ?? []).find((m: any) => m.id === mod.id);
      if (!fullModule) throw new Error('Module not found.');

      if (fullModule.content_url) {
        await cacheAssetForOffline(fullModule.content_url); // best-effort; content_text still saves either way
      }

      const cached: CachedModule = {
        id: mod.id, courseId: course.id, courseTitle: course.title, title: mod.title, type: mod.type,
        contentUrl: fullModule.content_url || undefined, contentText: fullModule.content_text || undefined,
        cachedAt: new Date().toISOString(),
      };
      await saveModule(cached);
      setCachedModules(prev => ({ ...prev, [mod.id]: cached }));

      // Downloading a module for offline is the trainee's real engagement
      // signal here (there's no video-watch-time/scroll-depth tracking in
      // this MVP) — queue it as progress and flush immediately if online,
      // so the online case doesn't wait for the next `online` event.
      await queueProgress({ courseId: course.id, moduleId: mod.id, moduleTitle: mod.title, progressPct: 100 });
      if (navigator.onLine) await flushOfflineQueues();
    } catch (err: any) {
      setDownloadError(prev => ({ ...prev, [mod.id]: err.message || 'Download failed.' }));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRemoveDownload = async (mod: CourseModule) => {
    const cached = cachedModules[mod.id];
    if (cached?.contentUrl) uncacheOfflineAsset(cached.contentUrl);
    await deleteModule(mod.id);
    setCachedModules(prev => { const next = { ...prev }; delete next[mod.id]; return next; });
  };

  const moduleIcon = (type: string) => {
    switch (type) { case 'VIDEO': return <Video className="w-3.5 h-3.5" />; case 'PDF': case 'DOCUMENT': return <FileText className="w-3.5 h-3.5" />; case 'QUIZ': return <HelpCircle className="w-3.5 h-3.5" />; default: return <FileText className="w-3.5 h-3.5" />; }
  };

  const filtered = courses.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Learning_LMS // Courses
          </div>
          {!isNative && (
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">{t('heading')}</h1>
          )}
        </div>
        {!isTrainee && (
          <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-2" /> {t('addCourse')}
          </Button>
        )}
      </motion.div>

      {/* Create Form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">{t('newCourse')}</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Programme ID" value={form.programme_id} onChange={e => setForm({ ...form, programme_id: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Course Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <textarea className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full h-20" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Duration (hours)" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: parseInt(e.target.value) || 1 })} />
              <div className="flex items-end"><Button onClick={handleCreate} className="rounded font-mono text-xs uppercase w-full">{t('createCourse')}</Button></div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Course List */}
      <div className="space-y-4">
        {filtered.map(course => (
          <Card key={course.id} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                    <Link href={`/dashboard/courses/${course.id}/learn`} className="hover:text-accent transition-colors"><h3 className="font-bold text-lg text-foreground">{course.title}</h3></Link>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${course.status === 'ACTIVE' ? 'border-green-500/40 text-green-500 bg-green-500/10' : 'border-border text-muted-foreground'}`}>{course.status}</span>
                  </div>
                  {course.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-4">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration_hours}h</span>
                    {course.programmes && <span>{t('programme')}: {course.programmes.title}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{course.course_modules?.length || 0} {t('modules')}</span>
                  </div>

                  {/* Modules */}
                  {course.course_modules && course.course_modules.length > 0 && (
                    <div className="border border-border rounded divide-y divide-border">
                      {course.course_modules.sort((a, b) => a.order_index - b.order_index).map(mod => {
                        const cached = cachedModules[mod.id];
                        const isExpanded = expandedId === mod.id;
                        return (
                          <div key={mod.id} data-testid={`module-row-${mod.id}`}>
                            <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                              {moduleIcon(mod.type)}
                              <span className="flex-1">{mod.title}</span>
                              <span className="text-[10px] font-mono uppercase text-muted-foreground border border-border px-1.5 py-0.5 rounded">{mod.type}</span>
                              {isTrainee && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {cached ? (
                                    <>
                                      <button onClick={() => setExpandedId(isExpanded ? null : mod.id)} className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1 border border-green-500/40 text-green-500 bg-green-500/10 rounded">
                                        <CheckCircle2 className="w-3 h-3" /> {t('downloaded')} {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                      <button onClick={() => handleRemoveDownload(mod)} title={t('removeDownload')} className="p-1 text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 rounded font-mono text-[10px] uppercase gap-1.5"
                                      disabled={downloadingId === mod.id}
                                      onClick={() => handleDownload(course, mod)}
                                    >
                                      <Download className="w-3 h-3" /> {downloadingId === mod.id ? t('downloading') : t('download')}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                            {downloadError[mod.id] && (
                              <div className="px-3 pb-2 text-xs font-mono text-destructive">{downloadError[mod.id]}</div>
                            )}
                            {isExpanded && cached && (
                              <div className="px-3 pb-3 space-y-2 bg-surface/50">
                                {cached.contentText && <p className="text-xs text-foreground whitespace-pre-wrap">{cached.contentText}</p>}
                                {cached.contentUrl && (
                                  <a href={cached.contentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline break-all">{cached.contentUrl}</a>
                                )}
                                {!cached.contentText && !cached.contentUrl && (
                                  <p className="text-xs text-muted-foreground">{t('noContentAvailable')}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {t('noCoursesFound')}
          </div>
        )}
      </div>
    </div>
  );
}
