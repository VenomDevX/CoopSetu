-- org_task_counters is an internal sequence table only touched by the
-- handoff.assign_task_number() SECURITY DEFINER trigger. No client access needed.
CREATE POLICY "deny_all" ON public.org_task_counters AS RESTRICTIVE USING (false);
