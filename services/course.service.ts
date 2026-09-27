import { SupabaseClient } from '@supabase/supabase-js';

export interface Course {
  id: string;
  programme_id: string;
  trainer_id?: string;
  title: string;
  description?: string;
  duration_hours: number;
  order_index: number;
  status: string;
  created_at: string;
  updated_at: string;
  programmes?: { title: string };
  trainers?: { profiles: { full_name: string } };
  course_modules?: CourseModule[];
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  type: string;
  content_url?: string;
  content_text?: string;
  duration_minutes: number;
  order_index: number;
  is_mandatory: boolean;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: string;
  options?: unknown[];
  correct_answer?: string;
  marks: number;
  order_index: number;
}

export interface Assessment {
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
  created_at: string;
  courses?: { title: string };
  assessment_questions?: AssessmentQuestion[];
}

export class CourseService {
  constructor(private supabase: SupabaseClient) {}

  async list(programmeId?: string) {
    let q = this.supabase
      .from('courses')
      .select('*, programmes(title), course_modules(id, title, type, order_index)')
      .order('order_index');

    if (programmeId) q = q.eq('programme_id', programmeId);

    const { data, error } = await q;
    if (error) throw error;
    return data as Course[];
  }

  /**
   * @param locale when given and not the source language, course and module
   * text is folded over with its translation. Each field falls back on its own,
   * so a partly translated module still renders rather than disappearing.
   */
  async getById(id: string, locale?: string) {
    const { data, error } = await this.supabase
      .from('courses')
      .select('*, programmes(title), course_modules(*), assessments(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data || !locale || locale === 'en') return data;

    const { applyTranslation, indexTranslations } = await import('@/lib/i18n/content-locale');
    const moduleIds = (data.course_modules || []).map((m: any) => m.id);

    const [courseTr, moduleTr] = await Promise.all([
      this.supabase.from('course_translations')
        .select('*').eq('course_id', id).eq('locale', locale).maybeSingle(),
      moduleIds.length
        ? this.supabase.from('course_module_translations')
            .select('*').in('module_id', moduleIds).eq('locale', locale)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const byModule = indexTranslations(moduleTr.data as any[], 'module_id');

    return {
      ...applyTranslation(data, courseTr.data, ['title', 'description']),
      course_modules: (data.course_modules || []).map((m: any) =>
        applyTranslation(m, byModule.get(m.id), ['title', 'content_text', 'content_url']),
      ),
    };
  }

  async create(input: { programme_id: string; title: string; description?: string; duration_hours?: number; trainer_id?: string; order_index?: number }) {
    const { data, error } = await this.supabase
      .from('courses')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Course;
  }

  async update(id: string, input: Partial<Course>) {
    const { data, error } = await this.supabase
      .from('courses')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Course;
  }

  async addModule(input: { course_id: string; title: string; type: string; content_url?: string; content_text?: string; duration_minutes?: number; order_index?: number; is_mandatory?: boolean }) {
    const { data, error } = await this.supabase
      .from('course_modules')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as CourseModule;
  }

  async updateModule(id: string, input: Partial<CourseModule>) {
    const { data, error } = await this.supabase
      .from('course_modules')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CourseModule;
  }

  async deleteModule(id: string) {
    const { error } = await this.supabase.from('course_modules').delete().eq('id', id);
    if (error) throw error;
  }

  async getProgress(traineeId: string, courseId: string) {
    const { data, error } = await this.supabase
      .from('course_progress')
      .select('*, course_modules(title, type)')
      .eq('trainee_id', traineeId)
      .eq('course_id', courseId);
    if (error) throw error;
    return data;
  }

  async updateProgress(traineeId: string, courseId: string, moduleId: string, progressPct: number) {
    const completed = progressPct >= 100;
    const { data, error } = await this.supabase
      .from('course_progress')
      .upsert({
        trainee_id: traineeId,
        course_id: courseId,
        module_id: moduleId,
        progress_pct: Math.min(progressPct, 100),
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        last_accessed_at: new Date().toISOString(),
      }, { onConflict: 'trainee_id,course_id,module_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export class AssessmentService {
  constructor(private supabase: SupabaseClient) {}

  async list(courseId?: string) {
    let q = this.supabase
      .from('assessments')
      .select('*, courses(title)')
      .order('created_at', { ascending: false });

    if (courseId) q = q.eq('course_id', courseId);

    const { data, error } = await q;
    if (error) throw error;
    return data as Assessment[];
  }

  async getById(id: string, locale?: string) {
    const { data, error } = await this.supabase
      .from('assessments')
      .select('*, courses(title), assessment_questions(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data || !locale || locale === 'en') return data;

    const { applyTranslation, indexTranslations } = await import('@/lib/i18n/content-locale');
    const questionIds = (data.assessment_questions || []).map((q: any) => q.id);

    const [assessmentTr, questionTr] = await Promise.all([
      this.supabase.from('assessment_translations')
        .select('*').eq('assessment_id', id).eq('locale', locale).maybeSingle(),
      questionIds.length
        ? this.supabase.from('assessment_question_translations')
            .select('*').in('question_id', questionIds).eq('locale', locale)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const byQuestion = indexTranslations(questionTr.data as any[], 'question_id');

    return {
      ...applyTranslation(data, assessmentTr.data, ['title', 'description']),
      // correct_answer is intentionally NOT translated: it is compared against
      // the option the trainee picked, and grading must not depend on which
      // language they read the question in. Options are replaced as a whole
      // array so their order still matches what correct_answer refers to.
      assessment_questions: (data.assessment_questions || []).map((q: any) =>
        applyTranslation(q, byQuestion.get(q.id), ['question_text', 'options']),
      ),
    };
  }

  async create(input: { course_id: string; title: string; description?: string; type?: string; max_score?: number; passing_score?: number; duration_minutes?: number; attempts_allowed?: number; is_published?: boolean }) {
    const { data, error } = await this.supabase
      .from('assessments')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Assessment;
  }

  async addQuestion(input: { assessment_id: string; question_text: string; question_type?: string; options?: unknown[]; correct_answer?: string; marks?: number; order_index?: number }) {
    const { data, error } = await this.supabase
      .from('assessment_questions')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async submitResult(input: { assessment_id: string; trainee_id: string; score: number; max_score: number; answers?: Record<string, unknown>; attempt_number?: number }) {
    // Was a hardcoded 40% that ignored assessments.passing_score entirely, so
    // an exam configured to require 60 passed anyone who scored 40. The
    // assessment's own threshold decides; 40% remains the fallback only when
    // the row cannot be read, matching the column default in 0071.
    const { data: assessment } = await this.supabase
      .from('assessments')
      .select('passing_score, max_score')
      .eq('id', input.assessment_id)
      .maybeSingle();

    const passMark = assessment?.passing_score != null && assessment?.max_score
      // passing_score is stored in marks against the assessment's own
      // max_score, which need not equal the max_score of this submission.
      ? (assessment.passing_score / assessment.max_score) * input.max_score
      : input.max_score * 0.4;

    const passed = input.score >= passMark;
    const { data, error } = await this.supabase
      .from('assessment_results')
      .insert({ ...input, passed })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getResults(assessmentId: string) {
    const { data, error } = await this.supabase
      .from('assessment_results')
      .select('*, trainees(id, profiles:user_id(full_name, email))')
      .eq('assessment_id', assessmentId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getTraineeResults(traineeId: string) {
    const { data, error } = await this.supabase
      .from('assessment_results')
      .select('*, assessments(title, type, max_score, courses(title))')
      .eq('trainee_id', traineeId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  /**
   * How many prior attempts a trainee has on record for an assessment.
   * Callers use this to compute the next attempt_number and enforce
   * attempts_allowed before calling submitResult.
   */
  async countAttempts(assessmentId: string, traineeId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('assessment_results')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId)
      .eq('trainee_id', traineeId);
    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Auto-grades MCQ/TRUE_FALSE answers against each question's
   * correct_answer, matched case-insensitively. SHORT_ANSWER/ESSAY questions
   * are never auto-graded — they always contribute 0 here, since free-text
   * grading needs a human (or a future AI grader); this is a known
   * limitation, not a bug: those marks simply aren't counted yet.
   *
   * Pure and deterministic on purpose — this is the one place a trainee's
   * score gets computed, and it must never trust a client-supplied score.
   */
  gradeAnswers(questions: AssessmentQuestion[], answers: Record<string, string>): number {
    return questions.reduce((sum, q) => {
      if (q.question_type !== 'MCQ' && q.question_type !== 'TRUE_FALSE') return sum;
      if (!q.correct_answer) return sum;
      const given = answers[q.id];
      const isCorrect = typeof given === 'string' && given.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
      return isCorrect ? sum + (q.marks ?? 1) : sum;
    }, 0);
  }
}
