-- ============================================================================
-- Grant permissions on CoopSetu tables to authenticated, anon, and service_role
-- ============================================================================

GRANT ALL ON public.institutions TO anon, authenticated, service_role;
GRANT ALL ON public.programmes TO anon, authenticated, service_role;
GRANT ALL ON public.trainers TO anon, authenticated, service_role;
GRANT ALL ON public.trainees TO anon, authenticated, service_role;
GRANT ALL ON public.batches TO anon, authenticated, service_role;
GRANT ALL ON public.enrollments TO anon, authenticated, service_role;
GRANT ALL ON public.courses TO anon, authenticated, service_role;
GRANT ALL ON public.course_modules TO anon, authenticated, service_role;
GRANT ALL ON public.assessments TO anon, authenticated, service_role;
GRANT ALL ON public.assessment_questions TO anon, authenticated, service_role;
GRANT ALL ON public.assessment_results TO anon, authenticated, service_role;
GRANT ALL ON public.course_progress TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_sessions TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_records TO anon, authenticated, service_role;
GRANT ALL ON public.trainee_skills TO anon, authenticated, service_role;
GRANT ALL ON public.certificates TO anon, authenticated, service_role;
GRANT ALL ON public.employers TO anon, authenticated, service_role;
GRANT ALL ON public.jobs TO anon, authenticated, service_role;
GRANT ALL ON public.job_skills TO anon, authenticated, service_role;
GRANT ALL ON public.job_applications TO anon, authenticated, service_role;
