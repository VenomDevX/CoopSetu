-- 1. Add encrypted_secrets to integrations
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS encrypted_secrets text;

-- 2. Revoke public access to encrypted_secrets to ensure it's only queried/updated securely via API if needed.
-- Wait, RLS already limits access. But we can ensure standard SELECTs don't leak it if we want.
-- Actually, RLS allows members to select integrations. 
-- In PostgreSQL, column-level security is possible, but simpler to just exclude it from the Next.js select queries.
-- For now, adding the column is sufficient since our API layer explicitly filters what's sent to the client.
