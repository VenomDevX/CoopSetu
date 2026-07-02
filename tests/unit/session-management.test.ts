import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/v1/sessions/route';
import { DELETE } from '@/app/api/v1/sessions/[sessionId]/route';
import { NextRequest } from 'next/server';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

describe('Session Management API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/v1/sessions returns active sessions for authenticated user', async () => {
    const mockSessions = [
      { id: '1', ip: '127.0.0.1', user_agent: 'Chrome' },
      { id: '2', ip: '192.168.1.1', user_agent: 'Safari' }
    ];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_123' } } })
      },
      rpc: vi.fn().mockResolvedValue({ data: mockSessions, error: null })
    };

    (createClient as any).mockResolvedValue(mockSupabase);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data).toEqual(mockSessions);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_active_sessions');
  });

  it('DELETE /api/v1/sessions/[sessionId] revokes the session', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_123' } } })
      },
      rpc: vi.fn().mockResolvedValue({ error: null })
    };

    (createClient as any).mockResolvedValue(mockSupabase);

    const request = new NextRequest('http://localhost:3000/api/v1/sessions/session_abc');
    const params = Promise.resolve({ sessionId: 'session_abc' });
    
    const response = await DELETE(request, { params });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('revoke_session', { p_session_id: 'session_abc' });
  });

  it('DELETE /api/v1/sessions/[sessionId] blocks unauthenticated users', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } })
      }
    };

    (createClient as any).mockResolvedValue(mockSupabase);

    const request = new NextRequest('http://localhost:3000/api/v1/sessions/session_abc');
    const params = Promise.resolve({ sessionId: 'session_abc' });
    
    const response = await DELETE(request, { params });
    const result = await response.json();

    expect(response.status).toBe(401);
    expect(result.error).toBe('Unauthorized');
  });
});
