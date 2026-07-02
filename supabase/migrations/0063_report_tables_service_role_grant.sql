-- 0050 granted service_role ALL on every table that existed at that time.
-- Postgres' `GRANT ... ON ALL TABLES IN SCHEMA` is a snapshot, not a
-- standing rule, so the report tables added later in 0061 (reports,
-- report_runs, report_schedules, report_deliveries) never received it —
-- the service-role report worker gets "permission denied" against them.
GRANT ALL ON public.reports, public.report_runs, public.report_schedules, public.report_deliveries TO service_role;
