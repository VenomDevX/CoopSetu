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

import { GET as GetCourse } from '@/app/api/v1/courses/[courseId]/route';
import { GET as GetProgress, POST as PostProgress } from '@/app/api/v1/courses/[courseId]/progress/route';
import { POST as PostModule } from '@/app/api/v1/courses/[courseId]/modules/route';

function req(url: string, method: 'GET' | 'POST' = 'GET') {
  return new NextRequest(url, {
    method,
    ...(method !== 'GET' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

describe('Unauthenticated access to course-detail/progress routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentMembership.mockResolvedValue(null);
    mockGetAuthContext.mockResolvedValue({ user: null, supabase: null });
  });

  it('GET /api/v1/courses/[courseId] returns 401 without a membership', async () => {
    const res = await GetCourse(req('http://localhost:3000/api/v1/courses/c1'), { params: Promise.resolve({ courseId: 'c1' }) });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/courses/[courseId]/progress returns 401 without a membership', async () => {
    const res = await GetProgress(req('http://localhost:3000/api/v1/courses/c1/progress'), { params: Promise.resolve({ courseId: 'c1' }) });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/courses/[courseId]/progress returns 401 without a membership', async () => {
    const res = await PostProgress(req('http://localhost:3000/api/v1/courses/c1/progress', 'POST'), { params: Promise.resolve({ courseId: 'c1' }) });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/courses/[courseId]/modules returns 401 without a membership', async () => {
    const res = await PostModule(req('http://localhost:3000/api/v1/courses/c1/modules', 'POST'), { params: Promise.resolve({ courseId: 'c1' }) });
    expect(res.status).toBe(401);
  });
});
