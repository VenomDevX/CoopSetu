import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { z } from 'zod';
import { connectRepositorySchema, importGithubRepositorySchema } from '@/lib/validation/integration';
import {
  GitHubApiError,
  listGithubRepos,
  listGithubPullRequests,
  listGithubCommits,
} from '@/lib/integrations/github';

/** Finds the org's active GitHub integration row, or throws a clear 404. */
export async function getActiveGithubIntegration(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('integrations')
    .select('id').eq('organization_id', orgId).eq('provider', 'github').eq('status', 'ACTIVE').maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('GitHub is not connected for this organization.');
  return data as { id: string };
}

/** Decrypts and returns the org's GitHub access token, or a clear reconnect error. */
async function getGithubAccessToken(orgId: string, integrationId: string) {
  const secrets = await getDecryptedIntegrationSecrets(orgId, integrationId);
  if (!secrets?.access_token) throw Errors.validation('GitHub connection is missing credentials. Please reconnect GitHub.');
  return secrets.access_token;
}

/** Lists the connected org's real GitHub repos. */
export async function listOrgGithubRepos(supabase: SupabaseClient, orgId: string) {
  const integration = await getActiveGithubIntegration(supabase, orgId);
  const accessToken = await getGithubAccessToken(orgId, integration.id);
  try {
    const repos = await listGithubRepos(accessToken);
    return { integration_id: integration.id, repos };
  } catch (err) {
    if (err instanceof GitHubApiError && err.code === 'UNAUTHORIZED') {
      throw Errors.validation('GitHub connection expired. Please reconnect GitHub.');
    }
    throw err;
  }
}

/**
 * Imports a specific GitHub repo the caller picked from `listOrgGithubRepos`.
 * Re-verifies the repo against GitHub server-side (rather than trusting the
 * client payload) before creating the repositories row.
 */
export async function importGithubRepository(
  supabase: SupabaseClient,
  orgId: string,
  input: z.infer<typeof importGithubRepositorySchema>,
) {
  const integration = await getActiveGithubIntegration(supabase, orgId);
  if (integration.id !== input.integration_id) throw Errors.forbidden('Integration does not belong to this organization.');
  const accessToken = await getGithubAccessToken(orgId, integration.id);

  let repos;
  try {
    repos = await listGithubRepos(accessToken);
  } catch (err) {
    if (err instanceof GitHubApiError && err.code === 'UNAUTHORIZED') {
      throw Errors.validation('GitHub connection expired. Please reconnect GitHub.');
    }
    throw err;
  }
  const match = repos.find((r) => r.id === input.github_repo_id);
  if (!match) throw Errors.forbidden('Repository not accessible with the connected GitHub account.');

  const repo = await createRepository(supabase, orgId, {
    integration_id: integration.id,
    name: match.name,
    provider: 'github',
    default_branch: match.default_branch,
    url: match.html_url,
  }, { source: 'github_import', github_repo_id: match.id });
  return repo;
}

export async function listRepositories(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('repositories')
    .select('*, pull_requests(count), ci_pipelines(count)').eq('organization_id', orgId);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createRepository(
  supabase: SupabaseClient,
  orgId: string,
  input: z.infer<typeof connectRepositorySchema>,
  auditMetadata?: Record<string, unknown>,
) {
  const { data, error } = await supabase.from('repositories').insert({
    organization_id: orgId,
    integration_id: input.integration_id,
    name: input.name,
    provider: input.provider,
    default_branch: input.default_branch,
    url: input.url,
    status: 'ACTIVE',
  }).select('*').single();
  if (error) throw Errors.internal(error.message);

  await createAuditLog(supabase, {
    organizationId: orgId,
    action: 'integration.repository_connected',
    entityType: 'integration',
    entityId: data.id,
    afterState: { name: input.name, provider: input.provider },
    metadata: auditMetadata,
  });
  return data;
}

export async function deleteRepository(supabase: SupabaseClient, orgId: string, repositoryId: string) {
  const { data: repo, error: fetchError } = await supabase.from('repositories')
    .select('id, name').eq('id', repositoryId).eq('organization_id', orgId).maybeSingle();
  if (fetchError) throw Errors.internal(fetchError.message);
  if (!repo) throw Errors.notFound('Repository not found.');

  const { error } = await supabase.from('repositories').delete().eq('id', repositoryId).eq('organization_id', orgId);
  if (error) throw Errors.internal(error.message);

  await createAuditLog(supabase, {
    organizationId: orgId,
    action: 'integration.repository_deleted',
    entityType: 'integration',
    entityId: repositoryId,
    beforeState: { name: repo.name },
  });
  return { ok: true };
}

export async function listIntegrations(supabase: SupabaseClient, orgId: string) {
  // Explicitly do not select encrypted_secrets so it never leaks to the UI
  const { data, error } = await supabase.from('integrations')
    .select('id, organization_id, provider, display_name, status, config, created_at, updated_at')
    .eq('organization_id', orgId);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function updateIntegrationSecrets(supabase: SupabaseClient, orgId: string, integrationId: string, secrets: Record<string, string>) {
  const secretsJson = JSON.stringify(secrets);
  const encryptedPayload = encrypt(secretsJson);
  
  const { data, error } = await supabase.from('integrations')
    .update({ encrypted_secrets: encryptedPayload, status: 'ACTIVE' })
    .eq('id', integrationId)
    .eq('organization_id', orgId)
    .select('id').single();
    
  if (error) throw Errors.internal(error.message);
  
  await createAuditLog(supabase, {
    organizationId: orgId,
    action: 'integration.secrets_updated',
    entityType: 'integration',
    entityId: integrationId,
  });
  
  return data;
}

/**
 * Reads and decrypts stored integration secrets. This deliberately uses the
 * admin client rather than the caller's RLS-scoped client: `encrypted_secrets`
 * is REVOKEd from `authenticated` at the column level (see migration 0062),
 * so decrypting is inherently a privileged, server-only operation — callers
 * must independently enforce authz (e.g. `integration:manage`) before calling.
 */
export async function getDecryptedIntegrationSecrets(orgId: string, integrationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('integrations')
    .select('encrypted_secrets')
    .eq('id', integrationId)
    .eq('organization_id', orgId)
    .single();
    
  if (error || !data) throw Errors.notFound('Integration not found.');
  if (!data.encrypted_secrets) return null;
  
  const decryptedJson = decrypt(data.encrypted_secrets);
  return JSON.parse(decryptedJson) as Record<string, string>;
}

export async function listPullRequests(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('pull_requests')
    .select('*, author:author_member_id(id, profile:profiles!org_members_profile_fk(full_name))')
    .eq('organization_id', orgId).order('opened_at', { ascending: false }).limit(100);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listCommits(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('commits')
    .select('*, author:author_member_id(id, profile:profiles!org_members_profile_fk(full_name))')
    .eq('organization_id', orgId).order('committed_at', { ascending: false }).limit(50);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listPipelines(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('ci_pipelines').select('*, ci_jobs(*)')
    .eq('organization_id', orgId).order('started_at', { ascending: false }).limit(50);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listEnvironments(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('environments').select('*').eq('organization_id', orgId);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listDeployments(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('deployments').select('*')
    .eq('organization_id', orgId).order('started_at', { ascending: false }).limit(50);
  if (error) throw Errors.internal(error.message);
  return data;
}

/**
 * Mock "Sync Now": simulates pulling fresh data from a provider by creating a
 * new CI pipeline run + a commit on the first repo. No external credentials.
 */
export async function mockSync(supabase: SupabaseClient, orgId: string, memberId: string) {
  const { data: repo } = await supabase.from('repositories').select('id').eq('organization_id', orgId).limit(1).maybeSingle();
  if (!repo) throw Errors.notFound('No repositories to sync.');

  const { data: pipeline } = await supabase.from('ci_pipelines').insert({
    organization_id: orgId, repository_id: repo.id, branch: 'main', status: 'PASSED',
    triggered_by_member_id: memberId, external_id: `run-${Date.now()}`,
    completed_at: new Date().toISOString(),
  }).select('id').single();

  if (pipeline) {
    await supabase.from('ci_jobs').insert([
      { pipeline_id: pipeline.id, name: 'build', status: 'PASSED', duration_seconds: 42 },
      { pipeline_id: pipeline.id, name: 'test', status: 'PASSED', duration_seconds: 88 },
    ]);
  }
  await supabase.from('commits').insert({
    organization_id: orgId, repository_id: repo.id, external_hash: Math.random().toString(16).slice(2, 9),
    message: 'chore: mock sync commit', branch: 'main', author_member_id: memberId,
  });

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'integration.synced', entityType: 'integration',
    metadata: { mode: 'mock' },
  });
  return { ok: true, pipelineId: pipeline?.id };
}

/** Looks up a repository by id, scoped to the org, for the sync route. */
export async function getRepositoryForSync(supabase: SupabaseClient, orgId: string, repositoryId: string) {
  const { data, error } = await supabase.from('repositories').select('*')
    .eq('id', repositoryId).eq('organization_id', orgId).maybeSingle();
  if (error) throw Errors.internal(error.message);
  if (!data) throw Errors.notFound('Repository not found.');
  return data;
}

/** Parses "owner/name" out of a GitHub html_url like https://github.com/owner/name. */
function deriveOwnerRepo(url: string | null): { owner: string; name: string } {
  const match = url?.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/);
  if (!match) throw Errors.validation('Repository is missing a valid GitHub URL; re-import it.');
  return { owner: match[1], name: match[2] };
}

/** Maps a GitHub PR (state/draft/merged_at) to this app's status check-constraint values. */
function mapGithubPrStatus(pr: { state: string; draft: boolean; merged_at: string | null }): string {
  if (pr.merged_at) return 'MERGED';
  if (pr.state === 'closed') return 'CLOSED';
  if (pr.draft) return 'DRAFT';
  return 'OPEN';
}

/**
 * Real "Sync Now" for a GitHub-linked repository: pulls the repo's actual
 * pull requests + commits from the GitHub API and upserts them, replacing
 * mockSync's fabricated data for repos imported via importGithubRepository.
 */
export async function syncGithubRepository(
  supabase: SupabaseClient,
  orgId: string,
  repo: { id: string; integration_id: string | null; default_branch: string; url: string | null },
) {
  if (!repo.integration_id) throw Errors.validation('This repository is not linked to a GitHub connection.');
  const accessToken = await getGithubAccessToken(orgId, repo.integration_id);
  const { owner, name } = deriveOwnerRepo(repo.url);

  let prs, commits;
  try {
    [prs, commits] = await Promise.all([
      listGithubPullRequests(accessToken, owner, name),
      listGithubCommits(accessToken, owner, name, repo.default_branch),
    ]);
  } catch (err) {
    if (err instanceof GitHubApiError && err.code === 'UNAUTHORIZED') {
      throw Errors.validation('GitHub connection expired. Please reconnect GitHub.');
    }
    throw err;
  }

  if (prs.length) {
    const { error } = await supabase.from('pull_requests').upsert(
      prs.map((pr) => ({
        organization_id: orgId,
        repository_id: repo.id,
        external_id: String(pr.number),
        title: pr.title,
        status: mapGithubPrStatus(pr),
        source_branch: pr.head_ref,
        target_branch: pr.base_ref,
        opened_at: pr.created_at,
        merged_at: pr.merged_at,
      })),
      { onConflict: 'repository_id,external_id' },
    );
    if (error) throw Errors.internal(error.message);
  }

  if (commits.length) {
    const { error } = await supabase.from('commits').upsert(
      commits.map((c) => ({
        organization_id: orgId,
        repository_id: repo.id,
        external_hash: c.sha,
        message: c.message,
        branch: repo.default_branch,
        committed_at: c.committed_at,
      })),
      { onConflict: 'repository_id,external_hash' },
    );
    if (error) throw Errors.internal(error.message);
  }

  await createAuditLog(supabase, {
    organizationId: orgId, action: 'integration.synced', entityType: 'repository', entityId: repo.id,
    metadata: { mode: 'github', pullRequests: prs.length, commits: commits.length },
  });
  return { ok: true, mode: 'github', synced: { pullRequests: prs.length, commits: commits.length } };
}
