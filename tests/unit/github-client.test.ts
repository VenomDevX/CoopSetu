import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listGithubRepos,
  listGithubPullRequests,
  listGithubCommits,
  GitHubApiError,
} from '@/lib/integrations/github';

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return {
    ok: init?.status ? init.status >= 200 && init.status < 300 : true,
    status: init?.status ?? 200,
    headers: new Headers(init?.headers ?? {}),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('lib/integrations/github', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('listGithubRepos', () => {
    it('builds the correct request URL and headers', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse([]));
      await listGithubRepos('token-123');

      const [url, init] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('https://api.github.com/user/repos');
      expect(url).toContain('per_page=100');
      expect(url).toContain('sort=updated');
      expect(url).toContain('affiliation=owner%2Ccollaborator');
      expect(init.headers.Authorization).toBe('Bearer token-123');
      expect(init.headers.Accept).toBe('application/vnd.github+json');
      expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    });

    it('maps the GitHub response shape to a simplified summary', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse([
        {
          id: 1, full_name: 'acme/widgets', name: 'widgets', default_branch: 'main',
          html_url: 'https://github.com/acme/widgets', private: false, updated_at: '2026-01-01T00:00:00Z',
          extra_field_ignored: true,
        },
      ]));
      const repos = await listGithubRepos('token-123');
      expect(repos).toEqual([{
        id: 1, full_name: 'acme/widgets', name: 'widgets', default_branch: 'main',
        html_url: 'https://github.com/acme/widgets', private: false, updated_at: '2026-01-01T00:00:00Z',
      }]);
    });
  });

  describe('listGithubPullRequests', () => {
    it('builds the correct owner/repo path and query params', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse([]));
      await listGithubPullRequests('token-123', 'acme', 'widgets');
      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('/repos/acme/widgets/pulls');
      expect(url).toContain('state=all');
      expect(url).toContain('sort=updated');
      expect(url).toContain('direction=desc');
    });

    it('maps nested head/base refs into flat fields', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse([
        {
          id: 1, number: 42, title: 'Add feature', state: 'open', draft: false,
          head: { ref: 'feature-branch' }, base: { ref: 'main' },
          created_at: '2026-01-01T00:00:00Z', merged_at: null,
        },
      ]));
      const prs = await listGithubPullRequests('token-123', 'acme', 'widgets');
      expect(prs).toEqual([{
        id: 1, number: 42, title: 'Add feature', state: 'open', draft: false,
        head_ref: 'feature-branch', base_ref: 'main',
        created_at: '2026-01-01T00:00:00Z', merged_at: null,
      }]);
    });
  });

  describe('listGithubCommits', () => {
    it('builds the correct branch (sha) query param', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse([]));
      await listGithubCommits('token-123', 'acme', 'widgets', 'main');
      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('/repos/acme/widgets/commits');
      expect(url).toContain('sha=main');
    });

    it('maps nested commit message/date fields', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse([
        { sha: 'abc123', commit: { message: 'chore: fix', committer: { date: '2026-01-01T00:00:00Z' } } },
      ]));
      const commits = await listGithubCommits('token-123', 'acme', 'widgets', 'main');
      expect(commits).toEqual([{ sha: 'abc123', message: 'chore: fix', committed_at: '2026-01-01T00:00:00Z' }]);
    });
  });

  describe('error handling', () => {
    it('throws GitHubApiError with code UNAUTHORIZED on 401', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ message: 'Bad credentials' }, { status: 401 }));
      await expect(listGithubRepos('bad-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      } as Partial<GitHubApiError>);
    });

    it('throws GitHubApiError with code RATE_LIMITED on a rate-limited 403', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse(
        { message: 'rate limited' },
        { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1234567890' } },
      ));
      await expect(listGithubRepos('token-123')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    });

    it('throws GitHubApiError with code UNKNOWN on other non-2xx responses', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ message: 'server error' }, { status: 500 }));
      await expect(listGithubRepos('token-123')).rejects.toMatchObject({ code: 'UNKNOWN' });
    });
  });
});
