import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/security/encryption';
import { z } from 'zod';
import { connectRepositorySchema } from '@/lib/validation/integration';

export async function listRepositories(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('repositories')
    .select('*, pull_requests(count), ci_pipelines(count)').eq('organization_id', orgId);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function createRepository(supabase: SupabaseClient, orgId: string, input: z.infer<typeof connectRepositorySchema>) {
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
    afterState: { name: input.name, provider: input.provider }
  });
  return data;
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
  const { data, error } = await supabase.from('pull_requests').select('*')
    .eq('organization_id', orgId).order('opened_at', { ascending: false }).limit(100);
  if (error) throw Errors.internal(error.message);
  return data;
}

export async function listCommits(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('commits').select('*')
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
