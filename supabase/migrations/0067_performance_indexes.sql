-- ============================================================================
-- 0074_performance_indexes.sql
-- Evidence-based performance indexes for dashboard aggregate queries
-- ============================================================================

-- For Dashboard /api/v1/dashboard/overview aggregates by org + status
CREATE INDEX IF NOT EXISTS idx_tasks_org_status
ON public.tasks (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_bugs_org_status
ON public.bugs (organization_id, status);

-- For pending security reviews filtered by org or project
CREATE INDEX IF NOT EXISTS idx_security_reviews_org_status
ON public.security_reviews (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_security_reviews_project_status
ON public.security_reviews (project_id, status);
