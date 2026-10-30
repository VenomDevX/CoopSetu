import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Both routes short-circuit on a missing membership before ever touching
// Supabase, so only getCurrentMembership needs mocking here.
const mockGetCurrentMembership = vi.fn();
vi.mock('@/lib/auth/get-current-membership', () => ({
  getCurrentMembership: (...args: any[]) => mockGetCurrentMembership(...args),
}));

import { GET as GetTrainers, POST as PostTrainer } from '@/app/api/v1/trainers/route';
import { GET as GetBatches, POST as PostBatch } from '@/app/api/v1/batches/route';

function req(url: string, method: 'GET' | 'POST' = 'GET') {
  return new NextRequest(url, {
    method,
    ...(method === 'POST' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

describe('Unauthenticated access to /api/v1/trainers and /api/v1/batches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentMembership.mockResolvedValue(null);
  });

  it('GET /api/v1/trainers returns 401 without a membership', async () => {
    const res = await GetTrainers(req('http://localhost:3000/api/v1/trainers'));
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/trainers returns 401 without a membership', async () => {
    const res = await PostTrainer(req('http://localhost:3000/api/v1/trainers', 'POST'));
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/batches returns 401 without a membership', async () => {
    const res = await GetBatches(req('http://localhost:3000/api/v1/batches'));
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/batches returns 401 without a membership', async () => {
    const res = await PostBatch(req('http://localhost:3000/api/v1/batches', 'POST'));
    expect(res.status).toBe(401);
  });
});
