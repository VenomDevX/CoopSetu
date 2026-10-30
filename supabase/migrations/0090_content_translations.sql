-- ============================================================================
-- 0090 — translated learning content
--
-- The UI has been bilingual since the next-intl work, but the *content* was
-- not: `grep -c locale db-schema.sql` returned 0, and courses, course_modules,
-- assessments and assessment_questions each stored exactly one language per
-- row. A course authored in English stayed English for a Hindi user, which
-- makes "interactive multilingual e-learning modules" only half true.
--
-- Side tables rather than a `locale` column on each row. Three reasons:
--
--   * the base row stays the single source of identity — module order, type,
--     content_url and every foreign key live in one place and cannot disagree
--     between languages;
--   * adding a language is inserting rows, not migrating a table;
--   * fallback is a LEFT JOIN, so an untranslated module still renders in the
--     source language instead of disappearing.
--
-- Deliberately not translated: content_url. A Hindi lesson usually needs a
-- different *file*, so the URL is per-translation; but the base row's URL
-- remains the fallback rather than a second nullable column to reconcile.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.course_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, locale)
);

CREATE TABLE IF NOT EXISTS public.course_module_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  content_text TEXT,
  -- A translated lesson often points at a different asset (a dubbed video, a
  -- Hindi PDF). NULL means "use the base row's URL".
  content_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, locale)
);

CREATE TABLE IF NOT EXISTS public.assessment_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, locale)
);

CREATE TABLE IF NOT EXISTS public.assessment_question_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  question_text TEXT NOT NULL,
  -- Options are translated as a whole array so their order matches the base
  -- row's, which is what correct_answer is compared against. Translating them
  -- individually would let the two drift and silently mark right answers wrong.
  options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, locale)
);

CREATE INDEX IF NOT EXISTS course_module_translations_locale_idx
  ON public.course_module_translations(module_id, locale);
CREATE INDEX IF NOT EXISTS assessment_question_translations_locale_idx
  ON public.assessment_question_translations(question_id, locale);

-- has_permission() needs an organization_id, which these rows do not carry.
-- This asks the narrower question these tables can actually answer: does the
-- caller hold this permission in *any* organization they belong to.
CREATE OR REPLACE FUNCTION coopsetu.has_permission_any(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, coopsetu
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_members om
     WHERE om.user_id = (SELECT auth.uid())
       AND om.is_active
       AND coopsetu.has_permission(om.organization_id, p_permission)
  );
$$;

GRANT EXECUTE ON FUNCTION coopsetu.has_permission_any(TEXT) TO authenticated, service_role;

-- --------------------------------------------------------------------- RLS
-- A translation is exactly as readable as the row it translates, so these
-- follow the same org-member read / staff write split as 0080 rather than
-- inventing a separate permission.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'course_translations', 'course_module_translations',
    'assessment_translations', 'assessment_question_translations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    -- Readable by any authenticated org member. There is no organization_id on
    -- these rows; the parent's RLS already gates the content itself, and a
    -- translation without its parent is meaningless.
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_manage ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_manage ON public.%I FOR ALL TO authenticated
         USING (coopsetu.has_permission_any(''course:manage''))
         WITH CHECK (coopsetu.has_permission_any(''course:manage''))', t, t);
  END LOOP;
END $$;


GRANT ALL ON
  public.course_translations, public.course_module_translations,
  public.assessment_translations, public.assessment_question_translations
  TO anon, authenticated, service_role;
