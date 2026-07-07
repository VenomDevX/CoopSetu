import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/security/encryption';

// Never hit real api.github.com from this test — stub the GitHub client at
// the module level and assert against the stubbed data instead.
vi.mock('@/lib/integrations/github', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/integrations/github')>();
  return {
    ...actual,
    listGithubRepos: vi.fn(async () => [
      { id: 999, full_name: 'acme/widgets', name: 'widgets', default_branch: 'main', html_url: 'https://github.com/acme/widgets', private: false, updated_at: '2026-01-01T00:00:00Z' },
    ]),
    listGithubPullRequests: vi.fn(async () => [
      { id: 1, number: 7, title: 'Add feature', state: 'open', draft: false, head_ref: 'feat', base_ref: 'main', created_at: '2026-01-01T00:00:00Z', merged_at: null },
    ]),
    listGithubCommits: vi.fn(async () => [
      { sha: 'deadbeef', message: 'chore: fix', committed_at: '2026-01-01T00:00:00Z' },
    ]),
  };
});

import {
  listOrgGithubRepos,
  importGithubRepository,
  syncGithubRepository,
  getActiveGithubIntegration,
  deleteRepository,
} from '@/services/integration.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:55001';
const adminClient = createClient(URL, process.env.SUPABASE_SECRET_KEY!);

describe('GitHub repo import + sync (service layer, GitHub API mocked)', () => {
  let orgId: string;
  let userClient: SupabaseClient;
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const email = `gh-sync-${Date.now()}@example.com`;
    const { data: user } = await adminClient.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
    createdUserIds.push(user!.user!.id);

    const { data: org } = await adminClient.from('organizations').insert({ name: 'GH Sync Org', slug: `gh-sync-${Date.now()}` }).select('id').single();
    orgId = org!.id;
    createdOrgIds.push(orgId);

    const { data: member } = await adminClient.from('organization_members').insert({ organization_id: orgId, user_id: user!.user!.id }).select('id').single();
    const { data: ownerRole } = await adminClient.from('roles').select('id').eq('code', 'ORG_OWNER').is('organization_id', null).single();
    await adminClient.from('member_roles').insert({ organization_member_id: member!.id, role_id: ownerRole!.id });

    userClient = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await userClient.auth.signInWithPassword({ email, password: 'password123' });
  });

  afterAll(async () => {
    if (createdOrgIds.length) await adminClient.from('organizations').delete().in('id', createdOrgIds);
    for (const id of createdUserIds) await adminClient.auth.admin.deleteUser(id).catch(() => {});
  });

  it('throws a 404-style error when no GitHub integration exists yet', async () => {
    await expect(getActiveGithubIntegration(userClient, orgId)).rejects.toThrow(/not connected/i);
    await expect(listOrgGithubRepos(userClient, orgId)).rejects.toThrow(/not connected/i);
  });

  describe('once a GitHub integration is connected', () => {
    let integrationId: string;
    let repositoryId: string;

    beforeAll(async () => {
      const encryptedSecrets = encrypt(JSON.stringify({ access_token: 'fake-test-token' }));
      const { data: integration } = await adminClient.from('integrations').insert({
        organization_id: orgId, provider: 'github', display_name: 'GitHub', status: 'ACTIVE',
        encrypted_secrets: encryptedSecrets, config: {},
      }).select('id').single();
      integrationId = integration!.id;
    });

    it('lists the real (mocked) GitHub repos for the connected account', async () => {
      const { integration_id, repos } = await listOrgGithubRepos(userClient, orgId);
      expect(integration_id).toBe(integrationId);
      expect(repos).toEqual([
        { id: 999, full_name: 'acme/widgets', name: 'widgets', default_branch: 'main', html_url: 'https://github.com/acme/widgets', private: false, updated_at: '2026-01-01T00:00:00Z' },
      ]);
    });

    it('imports the picked repo, creating a repositories row linked to the integration', async () => {
      const repo = await importGithubRepository(userClient, orgId, {
        integration_id: integrationId,
        github_repo_id: 999,
        full_name: 'acme/widgets',
        default_branch: 'main',
        html_url: 'https://github.com/acme/widgets',
      });
      repositoryId = repo.id;

      expect(repo.name).toBe('widgets');
      expect(repo.integration_id).toBe(integrationId);
      expect(repo.provider).toBe('github');
      // Note: createAuditLog() reads Next.js request-scoped headers()/cookies()
      // internally, which aren't available when a service function is called
      // directly from a bare vitest process (not a real request) — it fails
      // silently in that case (logs a warning, never throws), same
      // pre-existing environmental limitation documented for other
      // createAuditLog callers (see docs/HANDOFF.md's group-a-actions.test.ts
      // note). Audit-log content is exercised in the unit test suite instead
      // (tests/unit/github-sync.service.test.ts), where callers are mocked.
    });

    it('rejects importing a repo the connected account cannot see', async () => {
      await expect(importGithubRepository(userClient, orgId, {
        integration_id: integrationId,
        github_repo_id: 12345, // not in the mocked repo list
        full_name: 'someone/else',
        default_branch: 'main',
        html_url: 'https://github.com/someone/else',
      })).rejects.toThrow(/not accessible/i);
    });

    it('syncs real (mocked) pull requests and commits for the imported repo', async () => {
      const { data: repoRow } = await adminClient.from('repositories').select('*').eq('id', repositoryId).single();
      const result = await syncGithubRepository(userClient, orgId, repoRow as any);
      expect(result).toEqual({ ok: true, mode: 'github', synced: { pullRequests: 1, commits: 1 } });

      const { data: pr } = await adminClient.from('pull_requests').select('*').eq('repository_id', repositoryId).eq('external_id', '7').maybeSingle();
      expect(pr?.title).toBe('Add feature');
      expect(pr?.status).toBe('OPEN');

      const { data: commit } = await adminClient.from('commits').select('*').eq('repository_id', repositoryId).eq('external_hash', 'deadbeef').maybeSingle();
      expect(commit?.message).toBe('chore: fix');
    });

    it('re-syncing the same repo is idempotent (upsert, not duplicate rows)', async () => {
      const { data: repoRow } = await adminClient.from('repositories').select('*').eq('id', repositoryId).single();
      await syncGithubRepository(userClient, orgId, repoRow as any);

      const { data: prs } = await adminClient.from('pull_requests').select('id').eq('repository_id', repositoryId).eq('external_id', '7');
      expect(prs).toHaveLength(1);

      const { data: commits } = await adminClient.from('commits').select('id').eq('repository_id', repositoryId).eq('external_hash', 'deadbeef');
      expect(commits).toHaveLength(1);
    });

    it('rejects deleting a repository that belongs to a different org', async () => {
      await expect(deleteRepository(userClient, '00000000-0000-0000-0000-000000000000', repositoryId)).rejects.toThrow(/not found/i);
    });

    it('deletes the repository, cascading its pull requests and commits', async () => {
      const result = await deleteRepository(userClient, orgId, repositoryId);
      expect(result).toEqual({ ok: true });

      const { data: repoRow } = await adminClient.from('repositories').select('id').eq('id', repositoryId).maybeSingle();
      expect(repoRow).toBeNull();

      const { data: prs } = await adminClient.from('pull_requests').select('id').eq('repository_id', repositoryId);
      expect(prs).toHaveLength(0);

      const { data: commits } = await adminClient.from('commits').select('id').eq('repository_id', repositoryId);
      expect(commits).toHaveLength(0);
    });

    it('throws a not-found error when deleting an already-deleted repository', async () => {
      await expect(deleteRepository(userClient, orgId, repositoryId)).rejects.toThrow(/not found/i);
    });
  });
});
