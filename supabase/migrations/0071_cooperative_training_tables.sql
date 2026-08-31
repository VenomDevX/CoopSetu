-- ============================================================================
-- CoopSetu: Cooperative Training Hub — Database Schema Migration
-- Creates all tables required for Training ERP, LMS, Attendance,
-- Certificates, Skills, and Employment Exchange modules.
-- ============================================================================

-- Institutions (VAMNICOM, RICM, ICM, etc.)
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'TRAINING_INSTITUTE',
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  capacity INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Programmes (training programmes offered)
CREATE TABLE IF NOT EXISTS public.programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 30,
  start_date DATE,
  end_date DATE,
  capacity INTEGER DEFAULT 50,
  fee NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trainers
CREATE TABLE IF NOT EXISTS public.trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  specialization TEXT,
  qualification TEXT,
  experience_years INTEGER DEFAULT 0,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Trainees
CREATE TABLE IF NOT EXISTS public.trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  education TEXT,
  location TEXT,
  languages TEXT[] DEFAULT '{}',
  experience TEXT,
  profile_photo TEXT,
  digital_literacy_level TEXT DEFAULT 'BASIC' CHECK (digital_literacy_level IN ('BASIC', 'INTERMEDIATE', 'ADVANCED')),
  employment_status TEXT DEFAULT 'UNEMPLOYED' CHECK (employment_status IN ('UNEMPLOYED', 'EMPLOYED', 'SELF_EMPLOYED', 'STUDENT')),
  date_of_birth DATE,
  gender TEXT,
  aadhaar_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'GRADUATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Batches
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  capacity INTEGER DEFAULT 30,
  room TEXT,
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enrollments (trainee → programme/batch)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ENROLLED', 'COMPLETED', 'DROPPED')),
  enrolled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trainee_id, programme_id)
);

-- ============================================================================
-- LMS TABLES
-- ============================================================================

-- Courses (within a programme)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_hours INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Modules (within a course: video, pdf, quiz)
CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('VIDEO', 'PDF', 'DOCUMENT', 'QUIZ', 'ASSIGNMENT')),
  content_url TEXT,
  content_text TEXT,
  duration_minutes INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessments
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'QUIZ' CHECK (type IN ('QUIZ', 'ASSIGNMENT', 'EXAM', 'PRACTICAL')),
  max_score INTEGER NOT NULL DEFAULT 100,
  passing_score INTEGER NOT NULL DEFAULT 40,
  duration_minutes INTEGER DEFAULT 60,
  attempts_allowed INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Questions (for quizzes)
CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'MCQ' CHECK (question_type IN ('MCQ', 'SHORT_ANSWER', 'TRUE_FALSE', 'ESSAY')),
  options JSONB DEFAULT '[]',
  correct_answer TEXT,
  marks INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Results
CREATE TABLE IF NOT EXISTS public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 100,
  passed BOOLEAN DEFAULT false,
  answers JSONB DEFAULT '{}',
  attempt_number INTEGER DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES public.trainers(id) ON DELETE SET NULL
);

-- Course Progress (per trainee per module)
CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trainee_id, course_id, module_id)
);

-- ============================================================================
-- ATTENDANCE TABLES
-- ============================================================================

-- Attendance Sessions
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT NOT NULL DEFAULT 'LECTURE' CHECK (session_type IN ('LECTURE', 'LAB', 'WORKSHOP', 'EXAM')),
  session_slot TEXT DEFAULT 'MORNING' CHECK (session_slot IN ('MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY')),
  qr_token TEXT UNIQUE,
  qr_expires_at TIMESTAMPTZ,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'MANUAL' CHECK (method IN ('QR', 'FACE', 'MANUAL')),
  status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  UNIQUE(session_id, trainee_id)
);

-- ============================================================================
-- SKILLS & CERTIFICATES
-- ============================================================================

-- Skills Master
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS skills_name_key;
ALTER TABLE public.skills ADD CONSTRAINT skills_name_key UNIQUE (name);

-- Trainee Skills
CREATE TABLE IF NOT EXISTS public.trainee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency INTEGER DEFAULT 0 CHECK (proficiency >= 0 AND proficiency <= 100),
  verified BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'SELF_DECLARED' CHECK (source IN ('SELF_DECLARED', 'COURSE', 'ASSESSMENT', 'TRAINER', 'CERTIFICATE')),
  verified_at TIMESTAMPTZ,
  UNIQUE(trainee_id, skill_id)
);

-- Certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  issuer_name TEXT DEFAULT 'NCCT',
  qr_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- EMPLOYMENT EXCHANGE
-- ============================================================================

-- Employers
CREATE TABLE IF NOT EXISTS public.employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT,
  company_size TEXT,
  location TEXT,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  employment_type TEXT NOT NULL DEFAULT 'FULL_TIME' CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE')),
  experience_min INTEGER DEFAULT 0,
  experience_max INTEGER,
  education_required TEXT,
  is_remote BOOLEAN DEFAULT false,
  vacancies INTEGER DEFAULT 1,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'FILLED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job Required Skills
CREATE TABLE IF NOT EXISTS public.job_skills (
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  importance TEXT DEFAULT 'REQUIRED' CHECK (importance IN ('REQUIRED', 'PREFERRED', 'NICE_TO_HAVE')),
  PRIMARY KEY (job_id, skill_id)
);

-- Job Applications
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  status TEXT NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'REVIEWED', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
  cover_letter TEXT,
  resume_url TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, trainee_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_institutions_org ON public.institutions(organization_id);
CREATE INDEX IF NOT EXISTS idx_programmes_org ON public.programmes(organization_id);
CREATE INDEX IF NOT EXISTS idx_programmes_institution ON public.programmes(institution_id);
CREATE INDEX IF NOT EXISTS idx_trainers_org ON public.trainers(organization_id);
CREATE INDEX IF NOT EXISTS idx_trainees_org ON public.trainees(organization_id);
CREATE INDEX IF NOT EXISTS idx_batches_programme ON public.batches(programme_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_trainee ON public.enrollments(trainee_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_programme ON public.enrollments(programme_id);
CREATE INDEX IF NOT EXISTS idx_courses_programme ON public.courses(programme_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON public.course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_assessments_course ON public.assessments(course_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_trainee ON public.assessment_results(trainee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch ON public.attendance_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_trainee ON public.attendance_records(trainee_id);
CREATE INDEX IF NOT EXISTS idx_trainee_skills_trainee ON public.trainee_skills(trainee_id);
CREATE INDEX IF NOT EXISTS idx_certificates_trainee ON public.certificates(trainee_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_employers_org ON public.employers(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_employer ON public.jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_trainee ON public.job_applications(trainee_id);

-- ============================================================================
-- SEED DEFAULT SKILLS
-- ============================================================================

INSERT INTO public.skills (name, category, description) VALUES
  ('Digital Literacy', 'TECHNOLOGY', 'Basic computer and internet skills'),
  ('MS Excel', 'TECHNOLOGY', 'Microsoft Excel proficiency'),
  ('Data Entry', 'TECHNOLOGY', 'Data entry and management skills'),
  ('Accounting', 'FINANCE', 'Basic accounting and bookkeeping'),
  ('Financial Management', 'FINANCE', 'Financial planning and management'),
  ('Cooperative Management', 'COOPERATIVE', 'Managing cooperative societies'),
  ('Cooperative Law', 'COOPERATIVE', 'Legal framework for cooperatives'),
  ('Cooperative Audit', 'COOPERATIVE', 'Auditing cooperative organizations'),
  ('Rural Development', 'DEVELOPMENT', 'Rural area development practices'),
  ('Entrepreneurship', 'BUSINESS', 'Starting and managing businesses'),
  ('Communication', 'SOFT_SKILLS', 'Effective communication skills'),
  ('Leadership', 'SOFT_SKILLS', 'Leadership and team management'),
  ('Marketing', 'BUSINESS', 'Marketing strategies and techniques'),
  ('Supply Chain', 'BUSINESS', 'Supply chain management'),
  ('Agriculture', 'DOMAIN', 'Agricultural practices and management'),
  ('Banking', 'FINANCE', 'Banking operations and procedures'),
  ('Insurance', 'FINANCE', 'Insurance products and services'),
  ('Project Management', 'MANAGEMENT', 'Managing projects effectively'),
  ('Human Resources', 'MANAGEMENT', 'HR management practices'),
  ('Quality Management', 'MANAGEMENT', 'Quality assurance and control')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies: org members can view their own org data
-- (More granular policies should be added per role in production)

CREATE POLICY "org_members_view_institutions" ON public.institutions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "org_members_view_programmes" ON public.programmes
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "org_members_view_trainers" ON public.trainers
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "org_members_view_trainees" ON public.trainees
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "org_members_view_batches" ON public.batches
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "skills_public_read" ON public.skills
  FOR SELECT USING (true);

CREATE POLICY "org_members_view_courses" ON public.courses
  FOR SELECT USING (
    programme_id IN (SELECT id FROM public.programmes WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true))
  );

CREATE POLICY "org_members_view_certificates" ON public.certificates
  FOR SELECT USING (
    trainee_id IN (SELECT id FROM public.trainees WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true))
  );

CREATE POLICY "org_members_view_jobs" ON public.jobs
  FOR SELECT USING (
    employer_id IN (SELECT id FROM public.employers WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true))
  );

CREATE POLICY "org_members_view_employers" ON public.employers
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true)
  );
