import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentMembership = vi.fn();
vi.mock('@/lib/auth/get-current-membership', () => ({
  getCurrentMembership: (...args: any[]) => mockGetCurrentMembership(...args),
}));

import { GET as GetEmployers, POST as PostEmployer } from '@/app/api/v1/employers/route';
import { PATCH as PatchEmployer } from '@/app/api/v1/employers/[employerId]/route';

function req(url: string, method: 'GET' | 'POST' | 'PATCH' = 'GET') {
  return new NextRequest(url, {
    method,
    ...(method !== 'GET' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

describe('Unauthenticated access to /api/v1/employers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentMembership.mockResolvedValue(null);
  });

  it('GET /api/v1/employers returns 401 without a membership', async () => {
    const res = await GetEmployers(req('http://localhost:3000/api/v1/employers'));
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/employers returns 401 without a membership', async () => {
    const res = await PostEmployer(req('http://localhost:3000/api/v1/employers', 'POST'));
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/employers/[employerId] returns 401 without a membership', async () => {
    const res = await PatchEmployer(
      req('http://localhost:3000/api/v1/employers/e1', 'PATCH'),
      { params: Promise.resolve({ employerId: 'e1' }) },
    );
    expect(res.status).toBe(401);
  });
});
