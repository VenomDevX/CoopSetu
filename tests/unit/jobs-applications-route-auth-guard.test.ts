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

import { PATCH as PatchJob } from '@/app/api/v1/jobs/[jobId]/route';
import { POST as ApplyToJob } from '@/app/api/v1/jobs/[jobId]/apply/route';
import { GET as GetApplications } from '@/app/api/v1/jobs/[jobId]/applications/route';
import { PATCH as PatchApplication } from '@/app/api/v1/jobs/[jobId]/applications/[applicationId]/route';

function req(url: string, method: 'GET' | 'POST' | 'PATCH' = 'GET') {
  return new NextRequest(url, {
    method,
    ...(method !== 'GET' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

describe('Unauthenticated access to job/application routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentMembership.mockResolvedValue(null);
    mockGetAuthContext.mockResolvedValue({ user: null, supabase: null });
  });

  it('PATCH /api/v1/jobs/[jobId] returns 401 without a membership', async () => {
    const res = await PatchJob(req('http://localhost:3000/api/v1/jobs/j1', 'PATCH'), { params: Promise.resolve({ jobId: 'j1' }) });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/jobs/[jobId]/apply returns 401 without a membership', async () => {
    const res = await ApplyToJob(req('http://localhost:3000/api/v1/jobs/j1/apply', 'POST'), { params: Promise.resolve({ jobId: 'j1' }) });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/jobs/[jobId]/applications returns 401 without a membership', async () => {
    const res = await GetApplications(req('http://localhost:3000/api/v1/jobs/j1/applications'), { params: Promise.resolve({ jobId: 'j1' }) });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/jobs/[jobId]/applications/[applicationId] returns 401 without a membership', async () => {
    const res = await PatchApplication(
      req('http://localhost:3000/api/v1/jobs/j1/applications/a1', 'PATCH'),
      { params: Promise.resolve({ jobId: 'j1', applicationId: 'a1' }) },
    );
    expect(res.status).toBe(401);
  });
});
