-- Migration 0076: Server-side legal acceptance write path
--
-- user_legal_acceptances has no client insert policy (0075), so every
-- acceptance must be written through this SECURITY DEFINER RPC. It always
-- derives the user id from auth.uid() -- the caller can never supply a
-- user_id, accepted_at, or document_id and have it trusted.

CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  p_terms_document_id UUID,
  p_privacy_document_id UUID,
  p_cookies_document_id UUID,
  p_acceptance_source TEXT,
  p_request_id TEXT,
  p_ip_hash TEXT,
  p_user_agent_hash TEXT
)
RETURNS public.user_legal_acceptances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_legal_acceptances;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Re-verify both documents are the currently active, published version of
  -- the correct type. This blocks acceptance against a stale/superseded id.
  IF NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_terms_document_id AND document_type = 'TERMS'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Terms document is not the active version';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_privacy_document_id AND document_type = 'PRIVACY'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Privacy document is not the active version';
  END IF;

  IF p_cookies_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_cookies_document_id AND document_type = 'COOKIES'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cookies document is not the active version';
  END IF;

  INSERT INTO public.user_legal_acceptances (
    user_id, terms_document_id, privacy_document_id, cookies_document_id,
    accepted_terms_at, accepted_privacy_at, accepted_cookies_at,
    acceptance_source, request_id, ip_hash, user_agent_hash
  ) VALUES (
    auth.uid(), p_terms_document_id, p_privacy_document_id, p_cookies_document_id,
    now(), now(), CASE WHEN p_cookies_document_id IS NOT NULL THEN now() ELSE NULL END,
    p_acceptance_source, p_request_id, p_ip_hash, p_user_agent_hash
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_legal_acceptance(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_legal_acceptance(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
