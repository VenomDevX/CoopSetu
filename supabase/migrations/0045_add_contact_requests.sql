-- ============================================================================
-- Handoff — 0045 Add Contact Requests Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  work_email text NOT NULL,
  company_name text NOT NULL,
  company_size text NOT NULL,
  role text NOT NULL,
  topic text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'website',
  ip_hash text,
  user_agent_hash text,
  honeypot_triggered boolean NOT NULL DEFAULT false,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT name_length_check CHECK (char_length(full_name) >= 2 AND char_length(full_name) <= 100),
  CONSTRAINT company_name_length_check CHECK (char_length(company_name) >= 2 AND char_length(company_name) <= 120),
  CONSTRAINT role_length_check CHECK (char_length(role) >= 2 AND char_length(role) <= 100),
  CONSTRAINT message_length_check CHECK (char_length(message) >= 10 AND char_length(message) <= 3000),
  CONSTRAINT email_format_check CHECK (work_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT company_size_check CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  CONSTRAINT topic_check CHECK (topic IN ('Request a Demo', 'Enterprise Sales', 'Product Question', 'Security Question', 'Partnership', 'Technical Support', 'Other')),
  CONSTRAINT status_check CHECK (status IN ('pending', 'reviewed', 'responded', 'closed'))
);

-- Enable RLS to block all public and authenticated direct DML.
-- Only accessible via service_role/secret client inside server routes.
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_updated_at
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
