-- 1. Add onboarding state columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS initial_setup_completed_at timestamptz;

-- 2. Backfill existing completed profiles
-- A profile is considered historically complete if it has a username and job_title.
UPDATE public.profiles
SET profile_completed_at = created_at
WHERE profile_completed_at IS NULL
  AND username IS NOT NULL
  AND job_title IS NOT NULL;

-- 3. Backfill existing organizations
-- Any organization that already exists is considered to have passed the initial setup phase.
-- This ensures existing Organization Owners are not forced back to /onboarding/team.
UPDATE public.organizations
SET initial_setup_completed_at = created_at
WHERE initial_setup_completed_at IS NULL;
