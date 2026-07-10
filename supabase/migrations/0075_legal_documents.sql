-- Migration 0075: Legal Documents and Acceptances

-- Legal Document Type Enum
CREATE TYPE public.legal_document_type AS ENUM ('TERMS', 'PRIVACY', 'COOKIES');

-- 1. legal_documents table
CREATE TABLE public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type public.legal_document_type NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  effective_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false
);

-- Constraint: Only one active published document per document_type
CREATE UNIQUE INDEX idx_legal_docs_active_type 
  ON public.legal_documents(document_type) 
  WHERE is_active = true;

-- Constraint: active documents must have published_at
ALTER TABLE public.legal_documents 
  ADD CONSTRAINT check_active_is_published 
  CHECK (NOT (is_active = true AND published_at IS NULL));

-- Enable RLS on legal_documents
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Clients can only read active published documents
CREATE POLICY "Public can view active legal documents"
  ON public.legal_documents
  FOR SELECT
  USING (is_active = true AND published_at IS NOT NULL);

-- (Implicit: clients cannot insert/update/delete because no policies exist for that)


-- 2. user_legal_acceptances table
CREATE TABLE public.user_legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT,
  privacy_document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE RESTRICT,
  cookies_document_id UUID REFERENCES public.legal_documents(id) ON DELETE RESTRICT,
  accepted_terms_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_privacy_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_cookies_at TIMESTAMPTZ,
  acceptance_source TEXT NOT NULL,
  request_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optimization indexes
CREATE INDEX idx_user_legal_acceptances_user_id ON public.user_legal_acceptances(user_id);

-- Enable RLS on user_legal_acceptances
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- User can view their own acceptances
CREATE POLICY "Users can view their own legal acceptances"
  ON public.user_legal_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts are intentionally left out of client RLS. 
-- The server will perform inserts using Service Role to ensure exact versioning logic.

-- 3. Seed Initial Documents
INSERT INTO public.legal_documents 
  (document_type, version, title, content_hash, effective_at, published_at, is_active)
VALUES
  ('TERMS', '1.0.0', 'Terms of Service', 'draft-hash-terms-v1', now(), now(), true),
  ('PRIVACY', '1.0.0', 'Privacy Policy', 'draft-hash-privacy-v1', now(), now(), true),
  ('COOKIES', '1.0.0', 'Cookie Policy', 'draft-hash-cookies-v1', now(), now(), true);
