import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLegalStatus } from '@/lib/legal/get-legal-status';
import { requireLegalAccepted } from '@/lib/legal/require-legal-accepted';
import { acceptLegalSchema } from '@/lib/validation/legal';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })();

async function freshUser(prefix: string): Promise<SupabaseClient> {
  const client = createClient(URL, KEY);
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { error } = await client.auth.signUp({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`signup ${email}: ${error.message}`);
  return client;
}

async function activeDocIds(client: SupabaseClient) {
  const { data } = await client
    .from('legal_documents')
    .select('id, document_type')
    .eq('is_active', true)
    .not('published_at', 'is', null);
  const terms = data?.find((d) => d.document_type === 'TERMS')?.id as string;
  const privacy = data?.find((d) => d.document_type === 'PRIVACY')?.id as string;
  return { terms, privacy };
}

async function acceptCurrent(client: SupabaseClient, requestId: string) {
  const { terms, privacy } = await activeDocIds(client);
  const { error } = await client.rpc('record_legal_acceptance', {
    p_terms_document_id: terms,
    p_privacy_document_id: privacy,
    p_cookies_document_id: null,
    p_acceptance_source: 'SIGNUP',
    p_request_id: requestId,
    p_ip_hash: 'deadbeef',
    p_user_agent_hash: 'deadbeef',
  });
  if (error) throw new Error(error.message);
}

describe('Legal consent: RLS write path', () => {
  it('user_legal_acceptances has no client insert policy -- direct insert is rejected', async () => {
    const client = await freshUser('legal-direct-insert');
    const { terms, privacy } = await activeDocIds(client);
    const { data: { user } } = await client.auth.getUser();

    const { error } = await client.from('user_legal_acceptances').insert({
      user_id: user!.id,
      terms_document_id: terms,
      privacy_document_id: privacy,
      acceptance_source: 'DIRECT_CLIENT_ATTEMPT',
      request_id: 'attempt-1',
    });

    expect(error).not.toBeNull();
  });

  it('record_legal_acceptance RPC writes a row tied to auth.uid()', async () => {
    const client = await freshUser('legal-rpc-write');
    const { terms, privacy } = await activeDocIds(client);

    const { data, error } = await client.rpc('record_legal_acceptance', {
      p_terms_document_id: terms,
      p_privacy_document_id: privacy,
      p_cookies_document_id: null,
      p_acceptance_source: 'SIGNUP',
      p_request_id: 'rpc-request-1',
      p_ip_hash: 'deadbeef',
      p_user_agent_hash: 'deadbeef',
    });

    expect(error).toBeNull();
    const { data: { user } } = await client.auth.getUser();
    expect(data.user_id).toBe(user!.id);
    expect(data.terms_document_id).toBe(terms);
    expect(data.privacy_document_id).toBe(privacy);
  });

  it('rejects acceptance against a non-active/fabricated document id', async () => {
    const client = await freshUser('legal-fake-doc');
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const { error } = await client.rpc('record_legal_acceptance', {
      p_terms_document_id: fakeId,
      p_privacy_document_id: fakeId,
      p_cookies_document_id: null,
      p_acceptance_source: 'SIGNUP',
      p_request_id: 'rpc-request-fake',
      p_ip_hash: 'deadbeef',
      p_user_agent_hash: 'deadbeef',
    });

    expect(error).not.toBeNull();
  });
});

describe('Legal consent: getLegalStatus / requireLegalAccepted guard', () => {
  it('a brand-new user has isAccepted=false and populated active version numbers', async () => {
    const client = await freshUser('legal-status-new');
    const { data: { user } } = await client.auth.getUser();

    const status = await getLegalStatus(user!, client);
    expect(status.isAccepted).toBe(false);
    expect(typeof status.termsVersion).toBe('string');
    expect(typeof status.privacyVersion).toBe('string');
  });

  it('isAccepted flips to true once the current documents are accepted', async () => {
    const client = await freshUser('legal-status-accept');
    const { data: { user } } = await client.auth.getUser();

    await acceptCurrent(client, 'rpc-status-accept');

    const status = await getLegalStatus(user!, client);
    expect(status.isAccepted).toBe(true);
  });

  it('requireLegalAccepted throws for a user who has not accepted', async () => {
    const client = await freshUser('legal-guard-unaccepted');
    const { data: { user } } = await client.auth.getUser();

    await expect(requireLegalAccepted(user!, client)).rejects.toThrow();
  });

  it('requireLegalAccepted resolves for a user who has accepted the current documents', async () => {
    const client = await freshUser('legal-guard-accepted');
    const { data: { user } } = await client.auth.getUser();
    await acceptCurrent(client, 'rpc-guard-accepted');

    await expect(requireLegalAccepted(user!, client)).resolves.not.toThrow();
  });

  it('rejects a payload that tries to smuggle trust-sensitive fields (user_id, document_id, ip)', () => {
    const result = acceptLegalSchema.safeParse({
      acceptedTerms: true,
      acceptedPrivacy: true,
      source: 'SIGNUP',
      user_id: '11111111-1111-1111-1111-111111111111',
      document_id: '22222222-2222-2222-2222-222222222222',
      ip: '1.2.3.4',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload where acceptedTerms/acceptedPrivacy is not exactly true', () => {
    expect(acceptLegalSchema.safeParse({ acceptedTerms: false, acceptedPrivacy: true }).success).toBe(false);
    expect(acceptLegalSchema.safeParse({ acceptedTerms: true, acceptedPrivacy: false }).success).toBe(false);
  });
});

