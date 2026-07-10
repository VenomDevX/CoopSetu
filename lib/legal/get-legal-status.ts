import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AuthContext } from '@/lib/auth/require-user';

export interface LegalStatus {
  isAccepted: boolean;
  termsDocumentId: string | null;
  privacyDocumentId: string | null;
  cookiesDocumentId: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  cookiesVersion: string | null;
}

/**
 * Resolves whether `user` has accepted the currently-active TERMS and
 * PRIVACY documents. Shared by GET /api/v1/legal/status, the onboarding
 * resolver, and every route-level guard so the "is this user compliant"
 * logic lives in exactly one place.
 *
 * Anonymous (demo) sessions are never checked here -- callers must exclude
 * them explicitly (see lib/legal/require-legal-accepted.ts) since demo
 * visitors are exempt from full Terms acceptance by design.
 */
export const getLegalStatus = cache(async (
  user: User,
  supabase: AuthContext['supabase'],
): Promise<LegalStatus> => {
  const { data: activeDocs, error: docsError } = await supabase
    .from('legal_documents')
    .select('id, document_type, version')
    .eq('is_active', true)
    .not('published_at', 'is', null);

  if (docsError) {
    throw new Error(`Failed to load active legal documents: ${docsError.message}`);
  }

  const termsDoc = activeDocs?.find((d) => d.document_type === 'TERMS') ?? null;
  const privacyDoc = activeDocs?.find((d) => d.document_type === 'PRIVACY') ?? null;
  const cookiesDoc = activeDocs?.find((d) => d.document_type === 'COOKIES') ?? null;

  // No active TERMS/PRIVACY published -- nothing to gate on.
  if (!termsDoc || !privacyDoc) {
    return {
      isAccepted: true,
      termsDocumentId: termsDoc?.id ?? null,
      privacyDocumentId: privacyDoc?.id ?? null,
      cookiesDocumentId: cookiesDoc?.id ?? null,
      termsVersion: termsDoc?.version ?? null,
      privacyVersion: privacyDoc?.version ?? null,
      cookiesVersion: cookiesDoc?.version ?? null,
    };
  }

  const { data: acceptances, error: accError } = await supabase
    .from('user_legal_acceptances')
    .select('terms_document_id, privacy_document_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (accError) {
    throw new Error(`Failed to load legal acceptances: ${accError.message}`);
  }

  const acceptance = acceptances && acceptances.length > 0 ? acceptances[0] : null;

  const hasAcceptedCurrent = !!acceptance
    && acceptance.terms_document_id === termsDoc.id
    && acceptance.privacy_document_id === privacyDoc.id;

  return {
    isAccepted: hasAcceptedCurrent,
    termsDocumentId: termsDoc.id,
    privacyDocumentId: privacyDoc.id,
    cookiesDocumentId: cookiesDoc?.id ?? null,
    termsVersion: termsDoc.version,
    privacyVersion: privacyDoc.version,
    cookiesVersion: cookiesDoc?.version ?? null,
  };
});
