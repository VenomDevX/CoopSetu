'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Clock, Users, Search, FileText, Video, HelpCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

interface Course {
  id: string;
  programme_id: string;
  title: string;
  description?: string;
  duration_hours: number;
  order_index: number;
  status: string;
  programmes?: { title: string };
  course_modules?: { id: string; title: string; type: string; order_index: number }[];
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ programme_id: '', title: '', description: '', duration_hours: 1 });

  const load = useCallback(() => {
    fetch('/api/v1/courses').then(r => r.json()).then(j => {
      if (j?.data) setCourses(j.data.courses || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await fetch('/api/v1/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm({ programme_id: '', title: '', description: '', duration_hours: 1 });
    load();
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
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Course Catalog</h1>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" /> Add Course
        </Button>
      </motion.div>

      {/* Create Form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">New Course</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Programme ID" value={form.programme_id} onChange={e => setForm({ ...form, programme_id: e.target.value })} />
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Course Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <textarea className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full h-20" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Duration (hours)" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: parseInt(e.target.value) || 1 })} />
              <div className="flex items-end"><Button onClick={handleCreate} className="rounded font-mono text-xs uppercase w-full">Create Course</Button></div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} />
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
                    <h3 className="font-bold text-lg text-foreground">{course.title}</h3>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${course.status === 'ACTIVE' ? 'border-green-500/40 text-green-500 bg-green-500/10' : 'border-border text-muted-foreground'}`}>{course.status}</span>
                  </div>
                  {course.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-4">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration_hours}h</span>
                    {course.programmes && <span>Programme: {course.programmes.title}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{course.course_modules?.length || 0} modules</span>
                  </div>

                  {/* Modules */}
                  {course.course_modules && course.course_modules.length > 0 && (
                    <div className="border border-border rounded divide-y divide-border">
                      {course.course_modules.sort((a, b) => a.order_index - b.order_index).map(mod => (
                        <div key={mod.id} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                          {moduleIcon(mod.type)}
                          <span className="flex-1">{mod.title}</span>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground border border-border px-1.5 py-0.5 rounded">{mod.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No courses found. Create your first course to build the learning catalog.
          </div>
        )}
      </div>
    </div>
  );
}
