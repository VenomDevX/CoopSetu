/**
 * Thin client for the real GitHub REST API. Kept separate from
 * services/integration.service.ts (raw external-API concerns vs.
 * Supabase/org concerns), mirroring how lib/security/encryption.ts is
 * separated from the service layer.
 */

const GITHUB_API_BASE = 'https://api.github.com';

export type GitHubApiErrorCode = 'UNAUTHORIZED' | 'RATE_LIMITED' | 'UNKNOWN';

export class GitHubApiError extends Error {
  status: number;
  code: GitHubApiErrorCode;

  constructor(message: string, status: number, code: GitHubApiErrorCode) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface GithubRepoSummary {
  id: number;
  full_name: string;
  name: string;
  default_branch: string;
  html_url: string;
  private: boolean;
  updated_at: string;
}

export interface GithubPullRequestSummary {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  head_ref: string;
  base_ref: string;
  created_at: string;
  merged_at: string | null;
}

export interface GithubCommitSummary {
  sha: string;
  message: string;
  committed_at: string;
}

async function githubFetch(path: string, accessToken: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${GITHUB_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 401) {
    throw new GitHubApiError('GitHub token is invalid or revoked. Please reconnect GitHub.', 401, 'UNAUTHORIZED');
  }
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const resetAt = res.headers.get('x-ratelimit-reset');
    throw new GitHubApiError(
      `GitHub API rate limit exceeded${resetAt ? ` (resets at ${new Date(Number(resetAt) * 1000).toISOString()})` : ''}.`,
      403,
      'RATE_LIMITED',
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GitHubApiError(text || `GitHub API request failed (${res.status}).`, res.status, 'UNKNOWN');
  }

  return res.json();
}

export async function listGithubRepos(accessToken: string): Promise<GithubRepoSummary[]> {
  const repos = await githubFetch('/user/repos', accessToken, {
    per_page: '100',
    sort: 'updated',
    affiliation: 'owner,collaborator',
  });
  return (repos as any[]).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    name: r.name,
    default_branch: r.default_branch,
    html_url: r.html_url,
    private: r.private,
    updated_at: r.updated_at,
  }));
}

export async function listGithubPullRequests(
  accessToken: string,
  owner: string,
  repo: string,
): Promise<GithubPullRequestSummary[]> {
  const prs = await githubFetch(`/repos/${owner}/${repo}/pulls`, accessToken, {
    state: 'all',
    per_page: '50',
    sort: 'updated',
    direction: 'desc',
  });
  return (prs as any[]).map((pr) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft,
    head_ref: pr.head?.ref,
    base_ref: pr.base?.ref,
    created_at: pr.created_at,
    merged_at: pr.merged_at,
  }));
}

export async function listGithubCommits(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<GithubCommitSummary[]> {
  const commits = await githubFetch(`/repos/${owner}/${repo}/commits`, accessToken, {
    sha: branch,
    per_page: '50',
  });
  return (commits as any[]).map((c) => ({
    sha: c.sha,
    message: c.commit?.message ?? '',
    committed_at: c.commit?.committer?.date ?? c.commit?.author?.date,
  }));
}
