'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Search, Plus, ChevronDown, ChevronUp, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { usePermission } from "@/lib/permissions/context";
import { queueSubmission } from "@/lib/offline/db";
import { GradeBadge } from '@/components/learning/grade-badge';
import { toGrade } from '@/lib/lms/grade';
import { useIsNative } from '@/components/native/native-provider';

interface Course { id: string; title: string; }

interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer?: string; // present only for staff (assessment:manage)
  marks: number;
}

interface Assessment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  type: string;
  max_score: number;
  passing_score: number;
  duration_minutes: number;
  attempts_allowed: number;
  is_published: boolean;
  courses?: { title: string };
  assessment_questions?: AssessmentQuestion[];
}

interface AssessmentResult {
  id: string;
  trainee_id: string;
  score: number;
  max_score: number;
  passed: boolean;
  attempt_number: number;
  submitted_at: string;
  trainees?: { id: string; profiles?: { full_name: string; email: string } };
}

const EMPTY_FORM = { course_id: '', title: '', description: '', type: 'QUIZ', max_score: 100, passing_score: 40, duration_minutes: 30, attempts_allowed: 1, is_published: true };
const EMPTY_QUESTION = { question_text: '', question_type: 'MCQ', options: '', correct_answer: '', marks: 1 };

export default function AssessmentsPage() {
  // The native app bar already names this screen, so the page's own <h1> is
  // a duplicate: two h1s on one screen, the second repeating what the sticky
  // bar above it already says. Dropping it in the app reclaims 40px (measured
  // on a Pixel 7) and leaves exactly one h1 on the page.
  const isNative = useIsNative();
  const { has, hasRole } = usePermission();
  const isStaff = has('assessment:manage');
  const isTrainee = hasRole('TRAINEE');

  const [courses, setCourses] = useState<Course[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, Assessment>>({});
  const [resultsById, setResultsById] = useState<Record<string, AssessmentResult[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({}); // assessmentId -> questionId -> answer
  const [submitState, setSubmitState] = useState<Record<string, { submitting?: boolean; result?: AssessmentResult; error?: string; queued?: boolean }>>({});

  const load = useCallback(() => {
    fetch('/api/v1/assessments').then(r => r.json()).then(j => {
      if (j?.data) setAssessments(j.data.assessments || []);
    });
    fetch('/api/v1/courses').then(r => r.json()).then(j => {
      if (j?.data) setCourses(j.data.courses || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await fetch('/api/v1/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowCreate(false);
    setForm(EMPTY_FORM);
    load();
  };

  const loadDetail = async (assessmentId: string) => {
    setLoadingDetail(assessmentId);
    const res = await fetch(`/api/v1/assessments/${assessmentId}`);
    const j = await res.json();
    if (j?.data) setDetailById(prev => ({ ...prev, [assessmentId]: j.data }));
    if (isStaff) {
      const rres = await fetch(`/api/v1/assessments/${assessmentId}/results`);
      const rj = await rres.json();
      setResultsById(prev => ({ ...prev, [assessmentId]: rj?.data?.results || [] }));
    }
    setLoadingDetail(null);
  };

  const toggleExpand = (assessmentId: string) => {
    if (expanded === assessmentId) { setExpanded(null); return; }
    setExpanded(assessmentId);
    if (!detailById[assessmentId]) loadDetail(assessmentId);
  };

  const handleAddQuestion = async (assessmentId: string) => {
    const options = questionForm.question_type === 'MCQ'
      ? questionForm.options.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    await fetch(`/api/v1/assessments/${assessmentId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...questionForm, options, marks: Number(questionForm.marks) || 1 }),
    });
    setQuestionForm(EMPTY_QUESTION);
    loadDetail(assessmentId);
  };

  const setAnswer = (assessmentId: string, questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [assessmentId]: { ...(prev[assessmentId] || {}), [questionId]: value } }));
  };

  const handleSubmitQuiz = async (assessmentId: string) => {
    setSubmitState(prev => ({ ...prev, [assessmentId]: { submitting: true } }));
    const submittedAnswers = answers[assessmentId] || {};
    try {
      const res = await fetch(`/api/v1/assessments/${assessmentId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: submittedAnswers }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to submit.');
      setSubmitState(prev => ({ ...prev, [assessmentId]: { result: j.data } }));
    } catch (err: any) {
      if (err instanceof TypeError) {
        // fetch() itself failed (not a server response) — offline, not a
        // real rejection. Queue the attempt (lib/offline/db.ts) instead of
        // losing it; lib/offline/sync.ts submits it for real once back
        // online, through this exact same route.
        const assessmentTitle = assessments.find(a => a.id === assessmentId)?.title ?? 'Assessment';
        await queueSubmission({ assessmentId, assessmentTitle, answers: submittedAnswers });
        setSubmitState(prev => ({ ...prev, [assessmentId]: { queued: true } }));
      } else {
        setSubmitState(prev => ({ ...prev, [assessmentId]: { error: err.message } }));
      }
    }
  };

  const visible = assessments.filter(a => (isStaff || a.is_published) && (!search || a.title.toLowerCase().includes(search.toLowerCase())));

  /** passing_score is stored in marks; the grade scale wants a percentage. */
  const gradePassPct = (a: { passing_score?: number; max_score?: number }) =>
    a.passing_score && a.max_score ? Math.round((a.passing_score / a.max_score) * 100) : 40;

  const typeIcon = (passed: boolean) => passed
    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
    : <XCircle className="w-3.5 h-3.5 text-red-500" />;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
            Learning_LMS // Assessments
          </div>
          {!isNative && (
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Assessments</h1>
          )}
          <p className="text-sm text-muted-foreground mt-2 font-mono">Quizzes, exams, and practical assessments</p>
        </div>
        {isStaff && (
          <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-2" /> New Assessment
          </Button>
        )}
      </motion.div>

      {isStaff && showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">New Assessment</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <textarea className="px-3 py-2 border border-border rounded bg-background text-sm font-mono col-span-full h-20" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <select className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="QUIZ">Quiz</option><option value="ASSIGNMENT">Assignment</option><option value="EXAM">Exam</option><option value="PRACTICAL">Practical</option>
              </select>
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Max Score" value={form.max_score} onChange={e => setForm({ ...form, max_score: parseInt(e.target.value) || 0 })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Passing Score" value={form.passing_score} onChange={e => setForm({ ...form, passing_score: parseInt(e.target.value) || 0 })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Duration (minutes)" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} />
              <input type="number" className="px-3 py-2 border border-border rounded bg-background text-sm font-mono" placeholder="Attempts Allowed" value={form.attempts_allowed} onChange={e => setForm({ ...form, attempts_allowed: parseInt(e.target.value) || 1 })} />
              <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} />
                Publish immediately (visible to trainees)
              </label>
              <div className="flex items-end"><Button onClick={handleCreate} disabled={!form.course_id || !form.title} className="rounded font-mono text-xs uppercase w-full">Create</Button></div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Search assessments..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-4">
        {visible.map(a => {
          const isOpen = expanded === a.id;
          const detail = detailById[a.id];
          const state = submitState[a.id] || {};
          return (
            <Card key={a.id} data-testid={`assessment-card-${a.id}`} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors">
              <button className="w-full text-left" onClick={() => toggleExpand(a.id)}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg text-foreground">{a.title}</h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded text-muted-foreground">{a.type}</span>
                      {!a.is_published && <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-yellow-500/40 text-yellow-500 bg-yellow-500/10 rounded">Draft</span>}
                    </div>
                    {a.courses && <div className="text-xs text-muted-foreground font-mono">{a.courses.title} · {a.duration_minutes} min · {a.max_score} pts</div>}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardContent>
              </button>

              {isOpen && (
                <div className="border-t border-border p-6 space-y-6">
                  {loadingDetail === a.id && <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Loading…</div>}

                  {detail && (
                    <div className="space-y-4">
                      {(detail.assessment_questions ?? []).map((q, i) => (
                        <div key={q.id} className="p-4 border border-border rounded space-y-2">
                          <div className="text-sm text-foreground font-medium">{i + 1}. {q.question_text} <span className="text-[10px] text-muted-foreground font-mono">({q.marks} pt{q.marks === 1 ? '' : 's'})</span></div>
                          {isTrainee && !state.result && (
                            q.question_type === 'MCQ' ? (
                              <div className="space-y-1">
                                {q.options.map((opt, oi) => (
                                  <label key={oi} className="flex items-center gap-2 text-xs font-mono">
                                    <input type="radio" name={`${a.id}-${q.id}`} value={opt} checked={(answers[a.id]?.[q.id] || '') === opt} onChange={() => setAnswer(a.id, q.id, opt)} />
                                    {opt}
                                  </label>
                                ))}
                              </div>
                            ) : q.question_type === 'TRUE_FALSE' ? (
                              <div className="flex gap-4">
                                {['True', 'False'].map(opt => (
                                  <label key={opt} className="flex items-center gap-2 text-xs font-mono">
                                    <input type="radio" name={`${a.id}-${q.id}`} value={opt} checked={(answers[a.id]?.[q.id] || '') === opt} onChange={() => setAnswer(a.id, q.id, opt)} />
                                    {opt}
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <textarea className="w-full px-3 py-2 border border-border rounded bg-background text-xs font-mono h-16" placeholder="Your answer" value={answers[a.id]?.[q.id] || ''} onChange={e => setAnswer(a.id, q.id, e.target.value)} />
                            )
                          )}
                          {isStaff && q.correct_answer && (
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Correct: {q.correct_answer}</div>
                          )}
                        </div>
                      ))}

                      {isTrainee && (detail.assessment_questions ?? []).length > 0 && (
                        state.result ? (
                          <div className={`flex items-center gap-2 p-4 border rounded text-sm font-mono ${state.result.passed ? 'border-green-500/40 bg-green-500/10 text-green-500' : 'border-red-500/40 bg-red-500/10 text-red-500'}`}>
                            {typeIcon(state.result.passed)}
                            {state.result.passed ? 'Passed' : 'Not passed'} — {state.result.score}/{state.result.max_score}
                            {/* The percentage and letter come from lib/lms/grade, the same
                                scale the trainee's own record and the API use. */}
                            <GradeBadge grade={toGrade(state.result.score, state.result.max_score, gradePassPct(a))} />
                          </div>
                        ) : state.queued ? (
                          <div className="flex items-center gap-2 p-4 border border-orange-500/40 bg-orange-500/10 text-orange-500 rounded text-sm font-mono">
                            Queued — you&apos;re offline. This will submit automatically once you&apos;re back online.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {state.error && <div className="text-xs font-mono text-destructive">{state.error}</div>}
                            <Button size="sm" className="rounded font-mono text-xs uppercase" disabled={state.submitting} onClick={() => handleSubmitQuiz(a.id)}>
                              {state.submitting ? 'Submitting…' : 'Submit Answers'}
                            </Button>
                          </div>
                        )
                      )}

                      {isStaff && (
                        <div className="border-t border-border pt-4 space-y-3">
                          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Add Question</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input className="px-3 py-2 border border-border rounded bg-background text-xs font-mono col-span-full" placeholder="Question text" value={questionForm.question_text} onChange={e => setQuestionForm({ ...questionForm, question_text: e.target.value })} />
                            <select className="px-3 py-2 border border-border rounded bg-background text-xs font-mono" value={questionForm.question_type} onChange={e => setQuestionForm({ ...questionForm, question_type: e.target.value })}>
                              <option value="MCQ">Multiple Choice</option><option value="TRUE_FALSE">True / False</option><option value="SHORT_ANSWER">Short Answer</option><option value="ESSAY">Essay</option>
                            </select>
                            <input type="number" className="px-3 py-2 border border-border rounded bg-background text-xs font-mono" placeholder="Marks" value={questionForm.marks} onChange={e => setQuestionForm({ ...questionForm, marks: parseInt(e.target.value) || 1 })} />
                            {questionForm.question_type === 'MCQ' && (
                              <input className="px-3 py-2 border border-border rounded bg-background text-xs font-mono col-span-full" placeholder="Options (comma-separated)" value={questionForm.options} onChange={e => setQuestionForm({ ...questionForm, options: e.target.value })} />
                            )}
                            {(questionForm.question_type === 'MCQ' || questionForm.question_type === 'TRUE_FALSE') && (
                              <input className="px-3 py-2 border border-border rounded bg-background text-xs font-mono col-span-full" placeholder="Correct answer (must match an option exactly)" value={questionForm.correct_answer} onChange={e => setQuestionForm({ ...questionForm, correct_answer: e.target.value })} />
                            )}
                            <div className="flex items-end"><Button size="sm" className="rounded font-mono text-xs uppercase w-full" disabled={!questionForm.question_text} onClick={() => handleAddQuestion(a.id)}>Add Question</Button></div>
                          </div>
                        </div>
                      )}

                      {isStaff && (
                        <div className="border-t border-border pt-4 space-y-3">
                          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Results ({(resultsById[a.id] || []).length})</div>
                          {(resultsById[a.id] || []).length === 0 && <div className="text-xs font-mono text-muted-foreground">No attempts yet.</div>}
                          {(resultsById[a.id] || []).map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 border border-border rounded text-xs font-mono">
                              <div>
                                <div className="text-foreground flex items-center gap-2">{r.trainees?.profiles?.full_name || 'Trainee'}</div>
                                {r.trainees?.profiles?.email && <div className="text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{r.trainees.profiles.email}</div>}
                              </div>
                              <div className="flex items-center gap-2">
                                {typeIcon(r.passed)}
                                {r.score}/{r.max_score} · Attempt {r.attempt_number}
                                <GradeBadge grade={toGrade(r.score, r.max_score, gradePassPct(a))} showPercentage={false} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {visible.length === 0 && (
          <div className="text-center py-16">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">No assessments {search ? 'match your search' : 'created yet'}</p>
            {!search && <p className="text-sm text-muted-foreground">Assessments are linked to courses. Create a course first, then add assessments.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
