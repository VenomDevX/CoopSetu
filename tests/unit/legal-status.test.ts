import { describe, it, expect } from 'vitest';
import { getLegalStatus } from '@/lib/legal/get-legal-status';
import { acceptLegalSchema } from '@/lib/validation/legal';

const USER = { id: 'user-1' } as any;

function mockSupabase({
  activeDocs,
  acceptance,
}: {
  activeDocs: Array<{ id: string; document_type: string; version: string }>;
  acceptance: { terms_document_id: string; privacy_document_id: string } | null;
}) {
  return {
    from(table: string) {
      if (table === 'legal_documents') {
        return {
          select: () => ({
            eq: () => ({
              not: () => Promise.resolve({ data: activeDocs, error: null }),
            }),
          }),
        };
      }
      if (table === 'user_legal_acceptances') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: acceptance ? [acceptance] : [], error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as any;
}

describe('getLegalStatus', () => {
  it('is unaccepted when the user has never accepted anything', async () => {
    const supabase = mockSupabase({
      activeDocs: [
        { id: 'terms-v1', document_type: 'TERMS', version: '1.0.0' },
        { id: 'privacy-v1', document_type: 'PRIVACY', version: '1.0.0' },
      ],
      acceptance: null,
    });

    const status = await getLegalStatus(USER, supabase);
    expect(status.isAccepted).toBe(false);
    expect(status.termsVersion).toBe('1.0.0');
    expect(status.privacyVersion).toBe('1.0.0');
  });

  it('is accepted when the latest acceptance matches both active document ids', async () => {
    const supabase = mockSupabase({
      activeDocs: [
        { id: 'terms-v1', document_type: 'TERMS', version: '1.0.0' },
        { id: 'privacy-v1', document_type: 'PRIVACY', version: '1.0.0' },
      ],
      acceptance: { terms_document_id: 'terms-v1', privacy_document_id: 'privacy-v1' },
    });

    const status = await getLegalStatus(USER, supabase);
    expect(status.isAccepted).toBe(true);
  });

  it('requires re-acceptance when the active TERMS document id has moved on (version bump)', async () => {
    const supabase = mockSupabase({
      activeDocs: [
        { id: 'terms-v2', document_type: 'TERMS', version: '2.0.0' }, // superseded id
        { id: 'privacy-v1', document_type: 'PRIVACY', version: '1.0.0' },
      ],
      // User previously accepted terms-v1, which is no longer active.
      acceptance: { terms_document_id: 'terms-v1', privacy_document_id: 'privacy-v1' },
    });

    const status = await getLegalStatus(USER, supabase);
    expect(status.isAccepted).toBe(false);
    expect(status.termsDocumentId).toBe('terms-v2');
  });

  it('requires re-acceptance when the active PRIVACY document id has moved on', async () => {
    const supabase = mockSupabase({
      activeDocs: [
        { id: 'terms-v1', document_type: 'TERMS', version: '1.0.0' },
        { id: 'privacy-v2', document_type: 'PRIVACY', version: '2.0.0' },
      ],
      acceptance: { terms_document_id: 'terms-v1', privacy_document_id: 'privacy-v1' },
    });

    const status = await getLegalStatus(USER, supabase);
    expect(status.isAccepted).toBe(false);
  });

  it('treats no published/active TERMS or PRIVACY document as trivially accepted', async () => {
    const supabase = mockSupabase({ activeDocs: [], acceptance: null });
    const status = await getLegalStatus(USER, supabase);
    expect(status.isAccepted).toBe(true);
  });
});

describe('acceptLegalSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = acceptLegalSchema.safeParse({ acceptedTerms: true, acceptedPrivacy: true });
    expect(result.success).toBe(true);
  });

  it('rejects any client-supplied trust-sensitive field', () => {
    for (const extra of [
      { user_id: 'x' },
      { accepted_at: '2026-01-01' },
      { document_id: 'x' },
      { ip: '1.2.3.4' },
      { role: 'ORG_ADMIN' },
      { organization_id: 'x' },
    ]) {
      const result = acceptLegalSchema.safeParse({ acceptedTerms: true, acceptedPrivacy: true, ...extra });
      expect(result.success).toBe(false);
    }
  });

  it('rejects acceptedTerms/acceptedPrivacy that are not literally true', () => {
    expect(acceptLegalSchema.safeParse({ acceptedTerms: false, acceptedPrivacy: true }).success).toBe(false);
    expect(acceptLegalSchema.safeParse({ acceptedTerms: true, acceptedPrivacy: false }).success).toBe(false);
    expect(acceptLegalSchema.safeParse({}).success).toBe(false);
  });
});
