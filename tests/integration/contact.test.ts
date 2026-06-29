import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as ContactHandler } from '@/app/api/v1/contact/route';

// Mock Supabase admin client
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockGte = vi.fn().mockReturnThis();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      insert: mockInsert,
    })),
  })),
}));

// Mock rate limiter
const mockCheckRateLimit = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
}));

function createJsonRequest(body: any, headers?: Record<string, string>) {
  return new NextRequest('http://localhost:3000/api/v1/contact', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('Contact Request API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockInsert.mockResolvedValue({ error: null });
    // Mock email count query to return 0 existing requests by default
    mockSelect.mockImplementation(() => ({
      eq: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: 0, error: null }),
        }),
      }),
    }));
  });

  it('successfully saves contact request and returns generic success response', async () => {
    const req = createJsonRequest({
      fullName: 'Parth Sharma',
      workEmail: 'parth@example.com',
      companyName: 'VenomDevX',
      companySize: '1-10',
      role: 'Engineer',
      topic: 'Request a Demo',
      message: 'Hello, this is a valid message of appropriate length.',
    });

    const res = await ContactHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Thank you. Your request has been received.');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Parth Sharma',
      work_email: 'parth@example.com',
      company_name: 'VenomDevX',
      company_size: '1-10',
      role: 'Engineer',
      topic: 'Request a Demo',
      message: 'Hello, this is a valid message of appropriate length.',
      status: 'pending',
      honeypot_triggered: false,
    }));
  });

  it('rejects invalid fields with 400 Bad Request', async () => {
    const req = createJsonRequest({
      fullName: 'P', // Too short (must be 2-100)
      workEmail: 'invalidemail', // Invalid email
      companyName: '', // Too short
      companySize: 'invalid-size', // Invalid enum
      role: 'Engineer',
      topic: 'Other',
      message: 'Short', // Too short (must be 10-3000)
    });

    const res = await ContactHandler(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid fields');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('silently flag honeypot submissions while still returning success', async () => {
    const req = createJsonRequest({
      fullName: 'Bot User',
      workEmail: 'bot@example.com',
      companyName: 'SpamCorp',
      companySize: '11-50',
      role: 'Scraper',
      topic: 'Other',
      message: 'This is a bot message of sufficient length.',
      honeypot: 'triggered-value',
    });

    const res = await ContactHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Bot User',
      honeypot_triggered: true,
    }));
  });

  it('returns 429 when IP rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const req = createJsonRequest({
      fullName: 'Parth Sharma',
      workEmail: 'parth@example.com',
      companyName: 'VenomDevX',
      companySize: '1-10',
      role: 'Engineer',
      topic: 'Request a Demo',
      message: 'Hello, this is a valid message of appropriate length.',
    });

    const res = await ContactHandler(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('900');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 429 when email rate limit is exceeded', async () => {
    // Mock count query to return 3 submissions (rate limit threshold)
    mockSelect.mockImplementation(() => ({
      eq: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: 3, error: null }),
        }),
      }),
    }));

    const req = createJsonRequest({
      fullName: 'Parth Sharma',
      workEmail: 'parth@example.com',
      companyName: 'VenomDevX',
      companySize: '1-10',
      role: 'Engineer',
      topic: 'Request a Demo',
      message: 'Hello, this is a valid message of appropriate length.',
    });

    const res = await ContactHandler(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('86400');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
