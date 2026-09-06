import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssessmentService } from '@/services/course.service';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('AssessmentService', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() returns assessments, optionally filtered by course', async () => {
    const rows = [{ id: 'a1', course_id: 'c1', title: 'Quiz 1' }];
    let filteredCourseId: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          select: vi.fn(() => builder),
          order: vi.fn(() => builder),
          eq: vi.fn((_col: string, val: any) => { filteredCourseId = val; return builder; }),
          then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.list('c1');

    expect(mockSupabase.from).toHaveBeenCalledWith('assessments');
    expect(filteredCourseId).toBe('c1');
    expect(result).toEqual(rows);
  });

  it('list() throws on a query error', async () => {
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          select: vi.fn(() => builder),
          order: vi.fn(() => builder),
          then: (resolve: any) => Promise.resolve({ data: null, error: new Error('boom') }).then(resolve),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    await expect(svc.list()).rejects.toThrow('boom');
  });

  it('getById() returns the assessment with embedded questions', async () => {
    const assessment = { id: 'a1', title: 'Quiz 1', assessment_questions: [{ id: 'q1' }] };
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: () => Promise.resolve({ data: assessment, error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.getById('a1');

    expect(result).toEqual(assessment);
  });

  it('create() inserts the given assessment fields', async () => {
    const created = { id: 'a1', course_id: 'c1', title: 'New Quiz' };
    let insertedPayload: any;
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn((payload: any) => { insertedPayload = payload; return { select: () => ({ single: () => Promise.resolve({ data: created, error: null }) }) }; }),
      })),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.create({ course_id: 'c1', title: 'New Quiz' });

    expect(insertedPayload).toMatchObject({ course_id: 'c1', title: 'New Quiz' });
    expect(result).toEqual(created);
  });

  it('addQuestion() inserts a question tied to the assessment', async () => {
    const question = { id: 'q1', assessment_id: 'a1', question_text: 'What is 2+2?' };
    let insertedPayload: any;
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn((payload: any) => { insertedPayload = payload; return { select: () => ({ single: () => Promise.resolve({ data: question, error: null }) }) }; }),
      })),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.addQuestion({ assessment_id: 'a1', question_text: 'What is 2+2?' });

    expect(insertedPayload).toMatchObject({ assessment_id: 'a1', question_text: 'What is 2+2?' });
    expect(result).toEqual(question);
  });

  /**
   * submitResult now reads the assessment's own passing_score first, so the
   * mock has to answer a select as well as an insert. It used to hardcode 40%
   * and ignore the column entirely — an assessment with a 60% bar passed a 45%
   * answer.
   */
  const submitMock = (assessment: any) => {
    let insertedPayload: any;
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'assessments') {
          const builder: any = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            maybeSingle: vi.fn(() => Promise.resolve({ data: assessment, error: null })),
          };
          return builder;
        }
        return {
          insert: vi.fn((payload: any) => {
            insertedPayload = payload;
            return { select: () => ({ single: () => Promise.resolve({ data: { ...payload, id: 'r1' }, error: null }) }) };
          }),
        };
      }),
    } as unknown as SupabaseClient;
    return { client, inserted: () => insertedPayload };
  };

  it('submitResult() computes passed from score/max_score and inserts the result', async () => {
    const pass = submitMock({ passing_score: 40, max_score: 100 });
    const passing = await new AssessmentService(pass.client)
      .submitResult({ assessment_id: 'a1', trainee_id: 't1', score: 50, max_score: 100 });
    expect(pass.inserted().passed).toBe(true);
    expect(passing.id).toBe('r1');

    const fail = submitMock({ passing_score: 40, max_score: 100 });
    await new AssessmentService(fail.client)
      .submitResult({ assessment_id: 'a1', trainee_id: 't1', score: 10, max_score: 100 });
    expect(fail.inserted().passed).toBe(false);
  });

  it("submitResult() honours the assessment's own passing_score, not a fixed 40%", async () => {
    const strict = submitMock({ passing_score: 60, max_score: 100 });
    await new AssessmentService(strict.client)
      .submitResult({ assessment_id: 'a1', trainee_id: 't1', score: 45, max_score: 100 });
    expect(strict.inserted().passed).toBe(false);

    const lenient = submitMock({ passing_score: 30, max_score: 100 });
    await new AssessmentService(lenient.client)
      .submitResult({ assessment_id: 'a1', trainee_id: 't1', score: 35, max_score: 100 });
    expect(lenient.inserted().passed).toBe(true);
  });

  it('submitResult() falls back to 40% when the assessment cannot be read', async () => {
    const orphan = submitMock(null);
    await new AssessmentService(orphan.client)
      .submitResult({ assessment_id: 'a1', trainee_id: 't1', score: 45, max_score: 100 });
    expect(orphan.inserted().passed).toBe(true);
  });

  it('getResults() lists results for an assessment ordered by submission time', async () => {
    const rows = [{ id: 'r1', assessment_id: 'a1' }];
    let filteredAssessmentId: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn((_col: string, val: any) => { filteredAssessmentId = val; return builder; }),
          order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.getResults('a1');

    expect(filteredAssessmentId).toBe('a1');
    expect(result).toEqual(rows);
  });

  it('getTraineeResults() lists a trainee\'s own results across assessments', async () => {
    const rows = [{ id: 'r1', trainee_id: 't1' }];
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.getTraineeResults('t1');

    expect(result).toEqual(rows);
  });

  it('countAttempts() returns the exact-count head query result', async () => {
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ count: 2, error: null })) })),
        })),
      })),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.countAttempts('a1', 't1');

    expect(result).toBe(2);
  });

  it('countAttempts() returns 0 rather than null when there are no prior attempts', async () => {
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ count: null, error: null })) })),
        })),
      })),
    } as unknown as SupabaseClient;

    const svc = new AssessmentService(mockSupabase);
    const result = await svc.countAttempts('a1', 't1');

    expect(result).toBe(0);
  });

  describe('gradeAnswers()', () => {
    const svc = new AssessmentService({} as SupabaseClient);

    it('awards marks for a correct MCQ answer and withholds them for a wrong one', () => {
      const questions = [
        { id: 'q1', assessment_id: 'a1', question_text: 'Capital of France?', question_type: 'MCQ', correct_answer: 'Paris', marks: 5, order_index: 0 },
      ];
      expect(svc.gradeAnswers(questions, { q1: 'Paris' })).toBe(5);
      expect(svc.gradeAnswers(questions, { q1: 'London' })).toBe(0);
    });

    it('matches case-insensitively and trims whitespace', () => {
      const questions = [
        { id: 'q1', assessment_id: 'a1', question_text: 'True or false: the sky is blue.', question_type: 'TRUE_FALSE', correct_answer: 'True', marks: 2, order_index: 0 },
      ];
      expect(svc.gradeAnswers(questions, { q1: '  true  ' })).toBe(2);
    });

    it('never auto-grades SHORT_ANSWER or ESSAY questions, even on an exact text match', () => {
      const questions = [
        { id: 'q1', assessment_id: 'a1', question_text: 'Explain RLS.', question_type: 'ESSAY', correct_answer: 'Row Level Security', marks: 10, order_index: 0 },
      ];
      expect(svc.gradeAnswers(questions, { q1: 'Row Level Security' })).toBe(0);
    });

    it('sums marks across multiple correctly-answered questions', () => {
      const questions = [
        { id: 'q1', assessment_id: 'a1', question_text: 'Q1', question_type: 'MCQ', correct_answer: 'A', marks: 3, order_index: 0 },
        { id: 'q2', assessment_id: 'a1', question_text: 'Q2', question_type: 'TRUE_FALSE', correct_answer: 'False', marks: 2, order_index: 1 },
      ];
      expect(svc.gradeAnswers(questions, { q1: 'A', q2: 'False' })).toBe(5);
      expect(svc.gradeAnswers(questions, { q1: 'A' })).toBe(3);
      expect(svc.gradeAnswers(questions, {})).toBe(0);
    });

    it('never awards marks for a question with no correct_answer on record', () => {
      const questions = [
        { id: 'q1', assessment_id: 'a1', question_text: 'Q1', question_type: 'MCQ', marks: 5, order_index: 0 },
      ];
      expect(svc.gradeAnswers(questions, { q1: 'anything' })).toBe(0);
    });
  });
});
