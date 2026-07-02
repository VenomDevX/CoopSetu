-- 1. Create a custom type to return session data safely without exposing internal GoTrue fields
CREATE TYPE public.user_session_info AS (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  ip text,
  user_agent text
);

-- 2. RPC to get active sessions for the current authenticated user
CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS SETOF public.user_session_info
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 
    id, 
    created_at, 
    updated_at, 
    ip, 
    user_agent
  FROM auth.sessions
  WHERE user_id = auth.uid();
$$;

-- Secure the execution of get_active_sessions
REVOKE EXECUTE ON FUNCTION public.get_active_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_sessions() TO authenticated;

-- 3. RPC to revoke a specific session for the current authenticated user
CREATE OR REPLACE FUNCTION public.revoke_session(p_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  DELETE FROM auth.sessions
  WHERE id = p_session_id AND user_id = auth.uid();
$$;

-- Secure the execution of revoke_session
REVOKE EXECUTE ON FUNCTION public.revoke_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_session(uuid) TO authenticated;
