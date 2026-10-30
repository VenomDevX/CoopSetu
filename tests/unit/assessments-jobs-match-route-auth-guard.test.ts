import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentMembership = vi.fn();
vi.mock('@/lib/auth/get-current-membership', () => ({
  getCurrentMembership: (...args: any[]) => mockGetCurrentMembership(...args),
}));
const mockGetAuthContext = vi.fn();
vi.mock('@/lib/auth/require-user', () => ({
  getAuthContext: (...args: any[]) => mockGetAuthContext(...args),
}));

import { GET as ListAssessments, POST as CreateAssessment } from '@/app/api/v1/assessments/route';
import { GET as GetAssessment } from '@/app/api/v1/assessments/[assessmentId]/route';
import { POST as AddQuestion } from '@/app/api/v1/assessments/[assessmentId]/questions/route';
import { GET as GetResults, POST as SubmitResult } from '@/app/api/v1/assessments/[assessmentId]/results/route';
import { GET as GetJobMatch } from '@/app/api/v1/jobs/[jobId]/match/route';

function req(url: string, method: 'GET' | 'POST' = 'GET') {
  return new NextRequest(url, {
    method,
    ...(method !== 'GET' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

describe('Unauthenticated access to assessment/job-match routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentMembership.mockResolvedValue(null);
    mockGetAuthContext.mockResolvedValue({ user: null, supabase: null });
  });

  it('GET /api/v1/assessments returns 401 without a membership', async () => {
    const res = await ListAssessments(req('http://localhost:3000/api/v1/assessments'));
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/assessments returns 401 without a membership', async () => {
    const res = await CreateAssessment(req('http://localhost:3000/api/v1/assessments', 'POST'));
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/assessments/[assessmentId] returns 401 without a membership', async () => {
    const res = await GetAssessment(req('http://localhost:3000/api/v1/assessments/a1'), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/assessments/[assessmentId]/questions returns 401 without a membership', async () => {
    const res = await AddQuestion(req('http://localhost:3000/api/v1/assessments/a1/questions', 'POST'), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/assessments/[assessmentId]/results returns 401 without a membership', async () => {
    const res = await GetResults(req('http://localhost:3000/api/v1/assessments/a1/results'), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/assessments/[assessmentId]/results returns 401 without a membership', async () => {
    const res = await SubmitResult(req('http://localhost:3000/api/v1/assessments/a1/results', 'POST'), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/jobs/[jobId]/match returns 401 without a membership', async () => {
    const res = await GetJobMatch(req('http://localhost:3000/api/v1/jobs/j1/match'), { params: Promise.resolve({ jobId: 'j1' }) });
    expect(res.status).toBe(401);
  });
});
