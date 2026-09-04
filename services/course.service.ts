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

  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('courses')
      .select('*, programmes(title), course_modules(*), assessments(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
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

  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('assessments')
      .select('*, courses(title), assessment_questions(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async create(input: { course_id: string; title: string; description?: string; type?: string; max_score?: number; passing_score?: number; duration_minutes?: number; attempts_allowed?: number }) {
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
    const passed = input.score >= (input.max_score * 0.4); // Default 40% passing
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
