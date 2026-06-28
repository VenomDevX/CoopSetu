import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as UsernameAvailability } from '@/app/api/v1/auth/username-availability/route';
import { POST as SlugAvailability } from '@/app/api/v1/auth/workspace-slug-availability/route';

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

// Mock rate limiter
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: vi.fn(() => true),
}));

function createJsonRequest(body: any) {
  return new NextRequest('http://localhost:3000/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Auth Availability Endpoints', () => {
  describe('Username Availability Endpoint', () => {
    it('returns available for valid, non-reserved usernames', async () => {
      const req = createJsonRequest({ username: 'developer.parth' });
      const res = await UsernameAvailability(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.available).toBe(true);
    });

    it('returns false for reserved usernames', async () => {
      const req = createJsonRequest({ username: 'admin' });
      const res = await UsernameAvailability(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.available).toBe(false);
    });

    it('returns false for invalid syntax', async () => {
      const req = createJsonRequest({ username: 'invalid user space' });
      const res = await UsernameAvailability(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.available).toBe(false);
    });
  });

  describe('Workspace Slug Availability Endpoint', () => {
    it('returns available for valid, non-reserved slugs', async () => {
      const req = createJsonRequest({ slug: 'my-workspace-slug' });
      const res = await SlugAvailability(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.available).toBe(true);
    });

    it('returns false for reserved slugs', async () => {
      const req = createJsonRequest({ slug: 'api' });
      const res = await SlugAvailability(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.available).toBe(false);
    });

    it('allows uppercase input by normalizing it to lowercase', async () => {
      const req = createJsonRequest({ slug: 'My-Workspace' });
      const res = await SlugAvailability(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.available).toBe(true);
    });
  });
});
