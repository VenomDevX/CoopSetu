-- ============================================================================
-- 0087 — richer course module types
--
-- 0071 allowed VIDEO | PDF | DOCUMENT | QUIZ | ASSIGNMENT. PS 26087 asks for
-- "multimedia & interactive learning tools", so this widens the vocabulary the
-- new player (components/learning/module-player.tsx) can render:
--
--   AUDIO        narrated lessons — the cohort being trained includes users
--                for whom listening beats reading
--   TEXT         an authored lesson body rather than a link to a file
--   INTERACTIVE  in-lesson practice
--   SCORM_LINK   externally hosted package, embedded
--
-- The old values all remain valid; nothing needs migrating.
-- ============================================================================

ALTER TABLE public.course_modules DROP CONSTRAINT IF EXISTS course_modules_type_check;

ALTER TABLE public.course_modules
  ADD CONSTRAINT course_modules_type_check
  CHECK (type IN (
    'VIDEO', 'AUDIO', 'PDF', 'DOCUMENT', 'TEXT',
    'QUIZ', 'ASSIGNMENT', 'INTERACTIVE', 'SCORM_LINK'
  ));

COMMENT ON COLUMN public.course_modules.type IS
  'Render mode. See components/learning/module-player.tsx for how each is played.';
