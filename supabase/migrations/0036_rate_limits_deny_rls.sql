-- rate_limits is an internal table only touched by the check_rate_limit()
-- SECURITY DEFINER function. No client access needed.
CREATE POLICY "deny_all" ON public.rate_limits AS RESTRICTIVE USING (false);
