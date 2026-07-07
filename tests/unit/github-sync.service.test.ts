import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/integrations/github', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/integrations/github')>();
  return {
    ...actual,
    listGithubPullRequests: vi.fn(),
    listGithubCommits: vi.fn(),
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/security/encryption', () => ({
  encrypt: vi.fn((s: string) => `encrypted:${s}`),
  decrypt: vi.fn(() => JSON.stringify({ access_token: 'fake-token' })),
}));

import { syncGithubRepository } from '@/services/integration.service';
import { listGithubPullRequests, listGithubCommits, GitHubApiError } from '@/lib/integrations/github';
import { createAdminClient } from '@/lib/supabase/admin';

function makeSupabaseMock() {
  const upsertCalls: { table: string; rows: unknown; options: unknown }[] = [];
  const supabase = {
    from: vi.fn((table: string) => ({
      upsert: vi.fn((rows: unknown, options: unknown) => {
        upsertCalls.push({ table, rows, options });
        return Promise.resolve({ error: null });
      }),
    })),
  } as unknown as SupabaseClient;
  return { supabase, upsertCalls };
}

function makeAdminMock() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { encrypted_secrets: 'irrelevant-ciphertext' }, error: null })),
          })),
        })),
      })),
    })),
  };
}

const testRepo = {
  id: 'repo-1',
  integration_id: 'integration-1',
  default_branch: 'main',
  url: 'https://github.com/acme/widgets',
};

describe('syncGithubRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createAdminClient as any).mockReturnValue(makeAdminMock());
  });

  it('upserts pull_requests and commits with the correct onConflict targets and row shapes', async () => {
    (listGithubPullRequests as any).mockResolvedValue([
      { id: 1, number: 42, title: 'Add feature', state: 'open', draft: false, head_ref: 'feat', base_ref: 'main', created_at: '2026-01-01T00:00:00Z', merged_at: null },
    ]);
    (listGithubCommits as any).mockResolvedValue([
      { sha: 'abc123', message: 'chore: fix', committed_at: '2026-01-01T00:00:00Z' },
    ]);

    const { supabase, upsertCalls } = makeSupabaseMock();
    const result = await syncGithubRepository(supabase, 'org-1', testRepo);

    expect(result).toEqual({ ok: true, mode: 'github', synced: { pullRequests: 1, commits: 1 } });

    const prCall = upsertCalls.find((c) => c.table === 'pull_requests')!;
    expect(prCall.options).toEqual({ onConflict: 'repository_id,external_id' });
    expect(prCall.rows).toEqual([{
      organization_id: 'org-1', repository_id: 'repo-1', external_id: '42', title: 'Add feature',
      status: 'OPEN', source_branch: 'feat', target_branch: 'main',
      opened_at: '2026-01-01T00:00:00Z', merged_at: null,
    }]);

    const commitCall = upsertCalls.find((c) => c.table === 'commits')!;
    expect(commitCall.options).toEqual({ onConflict: 'repository_id,external_hash' });
    expect(commitCall.rows).toEqual([{
      organization_id: 'org-1', repository_id: 'repo-1', external_hash: 'abc123',
      message: 'chore: fix', branch: 'main', committed_at: '2026-01-01T00:00:00Z',
    }]);
  });

  it('maps merged/closed/draft PR states to the correct status values', async () => {
    (listGithubPullRequests as any).mockResolvedValue([
      { id: 1, number: 1, title: 'Merged PR', state: 'closed', draft: false, head_ref: 'a', base_ref: 'main', created_at: 'x', merged_at: '2026-01-02T00:00:00Z' },
      { id: 2, number: 2, title: 'Closed PR', state: 'closed', draft: false, head_ref: 'b', base_ref: 'main', created_at: 'x', merged_at: null },
      { id: 3, number: 3, title: 'Draft PR', state: 'open', draft: true, head_ref: 'c', base_ref: 'main', created_at: 'x', merged_at: null },
      { id: 4, number: 4, title: 'Open PR', state: 'open', draft: false, head_ref: 'd', base_ref: 'main', created_at: 'x', merged_at: null },
    ]);
    (listGithubCommits as any).mockResolvedValue([]);

    const { supabase, upsertCalls } = makeSupabaseMock();
    await syncGithubRepository(supabase, 'org-1', testRepo);

    const rows = upsertCalls.find((c) => c.table === 'pull_requests')!.rows as any[];
    expect(rows.map((r) => r.status)).toEqual(['MERGED', 'CLOSED', 'DRAFT', 'OPEN']);
  });

  it('is idempotent — calling it twice with identical data upserts the same rows both times', async () => {
    (listGithubPullRequests as any).mockResolvedValue([
      { id: 1, number: 42, title: 'Add feature', state: 'open', draft: false, head_ref: 'feat', base_ref: 'main', created_at: '2026-01-01T00:00:00Z', merged_at: null },
    ]);
    (listGithubCommits as any).mockResolvedValue([
      { sha: 'abc123', message: 'chore: fix', committed_at: '2026-01-01T00:00:00Z' },
    ]);

    const { supabase, upsertCalls } = makeSupabaseMock();
    await syncGithubRepository(supabase, 'org-1', testRepo);
    await syncGithubRepository(supabase, 'org-1', testRepo);

    const prRows = upsertCalls.filter((c) => c.table === 'pull_requests').map((c) => c.rows);
    expect(prRows[0]).toEqual(prRows[1]);
  });

  it('throws a clear "reconnect" error when the GitHub token is unauthorized', async () => {
    (listGithubPullRequests as any).mockRejectedValue(new GitHubApiError('bad token', 401, 'UNAUTHORIZED'));
    (listGithubCommits as any).mockResolvedValue([]);

    const { supabase } = makeSupabaseMock();
    await expect(syncGithubRepository(supabase, 'org-1', testRepo)).rejects.toThrow(/reconnect GitHub/i);
  });

  it('throws a clear error when the repository has no linked GitHub integration', async () => {
    const { supabase } = makeSupabaseMock();
    await expect(
      syncGithubRepository(supabase, 'org-1', { ...testRepo, integration_id: null }),
    ).rejects.toThrow(/not linked to a GitHub connection/i);
  });

  it('throws a clear error when the repository URL is not a valid GitHub URL', async () => {
    const { supabase } = makeSupabaseMock();
    await expect(
      syncGithubRepository(supabase, 'org-1', { ...testRepo, url: 'not-a-url' }),
    ).rejects.toThrow(/valid GitHub URL/i);
  });
});
