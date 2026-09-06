-- ============================================================================
-- 0091 — LMS engagement tracking and achievements
--
-- Two things the schema could not express.
--
-- 1. HISTORY. course_progress holds one mutable row per trainee x module with a
--    single last_accessed_at that updateProgress() overwrites on every write.
--    That is a current-state row, not a log: "how many trainees viewed this
--    video", "modules viewed per day", learning streaks and time-on-task are
--    all unreconstructable from it. lms_events is the append-only history that
--    sits beside it. Deliberately a separate table — folding history into
--    course_progress would break the UNIQUE(trainee_id, course_id, module_id)
--    its upsert depends on.
--
-- 2. RECOGNITION. There was no gamification of any kind anywhere in 90
--    migrations. Achievements are a catalogue plus recorded unlocks rather than
--    something recomputed each render, so "unlocked 3 days ago" is truthful and
--    a badge cannot silently un-earn itself when a rule changes.
-- ============================================================================

-- --------------------------------------------------------------- lms_events
CREATE TABLE IF NOT EXISTS public.lms_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'VIEW_START', 'VIEW_PROGRESS', 'MODULE_COMPLETE', 'COURSE_COMPLETE',
    'ASSESSMENT_SUBMIT', 'CERTIFICATE_EARNED', 'DOWNLOAD'
  )),
  progress_pct INTEGER CHECK (progress_pct BETWEEN 0 AND 100),
  seconds_spent INTEGER NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- The two access paths every analytics query uses: one trainee's history, and
-- one course's audience.
CREATE INDEX IF NOT EXISTS lms_events_trainee_time_idx ON public.lms_events(trainee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS lms_events_course_time_idx  ON public.lms_events(course_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS lms_events_module_idx       ON public.lms_events(module_id);
CREATE INDEX IF NOT EXISTS lms_events_org_time_idx     ON public.lms_events(organization_id, occurred_at DESC);

COMMENT ON TABLE public.lms_events IS
  'Append-only learning history. Never updated — course_progress is the current state.';

-- ------------------------------------------------------------- achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Award',
  tier TEXT NOT NULL DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
  -- { metric: 'modules_completed' | 'courses_completed' | 'assessments_passed'
  --   | 'perfect_scores' | 'streak_days' | 'certificates' | 'skills_verified',
  --   threshold: <int> }
  -- Data rather than code so a new badge is an INSERT, and the rule that
  -- awarded a badge stays readable next to the badge itself.
  criteria JSONB NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trainee_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- What the metric read when it was earned, so a trainee can see why.
  unlocked_value INTEGER,
  UNIQUE (trainee_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS trainee_achievements_trainee_idx
  ON public.trainee_achievements(trainee_id, unlocked_at DESC);

-- ------------------------------------------------- course_progress addition
-- Accumulated, not a duration of one visit: a module returned to across three
-- sittings should report the total. lms_events keeps the per-visit breakdown.
ALTER TABLE public.course_progress
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------ presentation modules
-- 0087 widened this once; PPT was missing, and a presentation is the format
-- most NCCT training material actually arrives in.
ALTER TABLE public.course_modules DROP CONSTRAINT IF EXISTS course_modules_type_check;
ALTER TABLE public.course_modules
  ADD CONSTRAINT course_modules_type_check
  CHECK (type IN (
    'VIDEO', 'AUDIO', 'PDF', 'DOCUMENT', 'TEXT', 'PPT', 'PRESENTATION',
    'QUIZ', 'ASSIGNMENT', 'INTERACTIVE', 'SCORM_LINK'
  ));

-- --------------------------------------------------------------------- RLS
ALTER TABLE public.lms_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainee_achievements ENABLE ROW LEVEL SECURITY;

-- Org members read the org's events; a trainee writes only their own. Follows
-- 0080's conventions rather than inventing new permissions.
DROP POLICY IF EXISTS lms_events_select ON public.lms_events;
CREATE POLICY lms_events_select ON public.lms_events
  FOR SELECT TO authenticated
  USING (coopsetu.is_org_member(organization_id));

DROP POLICY IF EXISTS lms_events_self_insert ON public.lms_events;
CREATE POLICY lms_events_self_insert ON public.lms_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trainees t
     WHERE t.id = lms_events.trainee_id
       AND t.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS lms_events_staff_manage ON public.lms_events;
CREATE POLICY lms_events_staff_manage ON public.lms_events
  FOR ALL TO authenticated
  USING (coopsetu.has_permission(organization_id, 'course:manage'))
  WITH CHECK (coopsetu.has_permission(organization_id, 'course:manage'));

-- The catalogue is not org-scoped: the same badges exist for everyone, and
-- nothing in it is sensitive.
DROP POLICY IF EXISTS achievements_read ON public.achievements;
CREATE POLICY achievements_read ON public.achievements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS trainee_achievements_read ON public.trainee_achievements;
CREATE POLICY trainee_achievements_read ON public.trainee_achievements
  FOR SELECT TO authenticated USING (true);

-- Unlocks are written server-side after a progress or assessment write, so the
-- insert path is service-role; no authenticated INSERT policy is granted.

GRANT ALL ON public.lms_events, public.achievements, public.trainee_achievements
  TO anon, authenticated, service_role;

-- ------------------------------------------------------- achievement catalogue
INSERT INTO public.achievements (code, name, description, icon, tier, criteria, points, sort_order) VALUES
  ('FIRST_STEPS',      'First Steps',        'Completed your first learning module.',            'Footprints', 'BRONZE',   '{"metric":"modules_completed","threshold":1}',   10, 1),
  ('GETTING_GOING',    'Getting Going',      'Completed five modules.',                          'TrendingUp', 'BRONZE',   '{"metric":"modules_completed","threshold":5}',   20, 2),
  ('DEDICATED',        'Dedicated Learner',  'Completed twenty modules.',                        'Flame',      'SILVER',   '{"metric":"modules_completed","threshold":20}',  50, 3),
  ('SCHOLAR',          'Scholar',            'Completed fifty modules.',                         'GraduationCap','GOLD',   '{"metric":"modules_completed","threshold":50}', 120, 4),
  ('COURSE_COMPLETE',  'Course Complete',    'Finished every module in a course.',               'BookCheck',  'SILVER',   '{"metric":"courses_completed","threshold":1}',   40, 5),
  ('TRIPLE_THREAT',    'Triple Threat',      'Finished three courses.',                          'Layers',     'GOLD',     '{"metric":"courses_completed","threshold":3}',  100, 6),
  ('FIRST_PASS',       'Assessment Passed',  'Passed your first assessment.',                    'ClipboardCheck','BRONZE','{"metric":"assessments_passed","threshold":1}',  15, 7),
  ('ASSESSMENT_ACE',   'Assessment Ace',     'Passed five assessments.',                         'Target',     'SILVER',   '{"metric":"assessments_passed","threshold":5}',  60, 8),
  ('PERFECT_SCORE',    'Perfect Score',      'Scored full marks on an assessment.',              'Star',       'GOLD',     '{"metric":"perfect_scores","threshold":1}',      80, 9),
  ('WEEK_STREAK',      'Seven Day Streak',   'Learned on seven consecutive days.',               'CalendarCheck','SILVER', '{"metric":"streak_days","threshold":7}',         70, 10),
  ('FORTNIGHT',        'Fourteen Day Streak','Learned on fourteen consecutive days.',            'Zap',        'GOLD',     '{"metric":"streak_days","threshold":14}',       150, 11),
  ('CERTIFIED',        'Certified',          'Earned an NCCT certificate.',                      'Award',      'GOLD',     '{"metric":"certificates","threshold":1}',       100, 12),
  ('SKILL_BUILDER',    'Skill Builder',      'Had five skills verified on your passport.',       'Wrench',     'SILVER',   '{"metric":"skills_verified","threshold":5}',     60, 13),
  ('PROGRAMME_GRAD',   'Programme Graduate', 'Completed a full training programme.',             'Trophy',     'PLATINUM', '{"metric":"programmes_completed","threshold":1}',200, 14)
ON CONFLICT (code) DO NOTHING;
