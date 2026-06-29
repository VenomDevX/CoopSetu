-- ============================================================================
-- Handoff — 0039 Database Performance Optimizations
-- This squashed migration combines multiple database linter fixes:
-- 1. Wrap bare auth.uid() calls in (SELECT auth.uid()) for InitPlan optimization.
-- 2. Dynamically split '_manage' (FOR ALL) policies into separate INSERT, UPDATE, DELETE policies.
-- 3. Dynamically index all unindexed foreign keys in the public schema.
-- ============================================================================

-- ============================================================================
-- Part 1: Fix auth.uid() in RLS policies (InitPlan Performance)
-- ============================================================================

-- public.employee_skills (from 0007)
DROP POLICY IF EXISTS emp_skills_manage ON public.employee_skills;
CREATE POLICY emp_skills_manage ON public.employee_skills
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = employee_skills.organization_member_id
        AND (m.user_id = (SELECT auth.uid()) OR handoff.has_permission(m.organization_id, 'member:manage'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = employee_skills.organization_member_id
        AND (m.user_id = (SELECT auth.uid()) OR handoff.has_permission(m.organization_id, 'member:manage'))
    )
  );

-- public.employee_availability (from 0007)
DROP POLICY IF EXISTS emp_avail_manage ON public.employee_availability;
CREATE POLICY emp_avail_manage ON public.employee_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = employee_availability.organization_member_id
        AND (m.user_id = (SELECT auth.uid()) OR handoff.has_permission(m.organization_id, 'member:manage'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = employee_availability.organization_member_id
        AND (m.user_id = (SELECT auth.uid()) OR handoff.has_permission(m.organization_id, 'member:manage'))
    )
  );

-- public.leave_requests (from 0007)
DROP POLICY IF EXISTS leave_manage ON public.leave_requests;
CREATE POLICY leave_manage ON public.leave_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = leave_requests.organization_member_id
        AND (m.user_id = (SELECT auth.uid()) OR handoff.has_permission(m.organization_id, 'member:manage'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = leave_requests.organization_member_id
        AND (m.user_id = (SELECT auth.uid()) OR handoff.has_permission(m.organization_id, 'member:manage'))
    )
  );

-- public.organization_invite_roles (from 0031)
DROP POLICY IF EXISTS org_admins_can_view_invite_roles ON public.organization_invite_roles;
CREATE POLICY org_admins_can_view_invite_roles ON public.organization_invite_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.member_roles mr ON mr.organization_member_id = om.id
      JOIN public.roles r ON r.id = mr.role_id
      WHERE om.organization_id = organization_invite_roles.organization_id
        AND om.user_id = (SELECT auth.uid())
        AND r.code IN ('ORG_OWNER', 'ORG_ADMIN')
    )
  );

-- public.attachments (from 0010)
DROP POLICY IF EXISTS attachments_insert ON public.attachments;
CREATE POLICY attachments_insert ON public.attachments FOR INSERT
  WITH CHECK (handoff.is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = uploaded_by_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS attachments_delete ON public.attachments;
CREATE POLICY attachments_delete ON public.attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = uploaded_by_member_id AND m.user_id = (SELECT auth.uid())
    )
    OR (task_id IS NOT NULL AND handoff.can_manage_project(handoff.task_project(task_id)))
  );

-- public.notifications (from 0010)
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = recipient_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = recipient_member_id AND m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = recipient_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

-- public.notification_preferences (from 0010)
DROP POLICY IF EXISTS notif_prefs_all ON public.notification_preferences;
CREATE POLICY notif_prefs_all ON public.notification_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = organization_member_id AND m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = organization_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

-- public.presence_sessions (from 0010)
DROP POLICY IF EXISTS presence_all ON public.presence_sessions;
CREATE POLICY presence_all ON public.presence_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = organization_member_id AND m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = organization_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

-- public.task_comments (from 0010)
DROP POLICY IF EXISTS comments_insert ON public.task_comments;
CREATE POLICY comments_insert ON public.task_comments FOR INSERT
  WITH CHECK (
    handoff.can_view_project(handoff.task_project(task_id))
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = author_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS comments_update_own ON public.task_comments;
CREATE POLICY comments_update_own ON public.task_comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = author_member_id AND m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = author_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

-- public.comment_mentions (from 0010)
DROP POLICY IF EXISTS mentions_insert ON public.comment_mentions;
CREATE POLICY mentions_insert ON public.comment_mentions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.task_comments c
      JOIN public.organization_members m ON m.id = c.author_member_id
      WHERE c.id = comment_id AND m.user_id = (SELECT auth.uid())
    )
  );

-- public.document_comments (from 0012)
DROP POLICY IF EXISTS doc_comments_insert ON public.document_comments;
CREATE POLICY doc_comments_insert ON public.document_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.organization_members m ON m.id = author_member_id
      WHERE d.id = document_id AND m.user_id = (SELECT auth.uid()) AND handoff.is_org_member(d.organization_id)
    )
  );

-- public.ai_requests (from 0012)
DROP POLICY IF EXISTS ai_requests_select ON public.ai_requests;
CREATE POLICY ai_requests_select ON public.ai_requests FOR SELECT
  USING (
    handoff.is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = requester_member_id AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS ai_requests_insert ON public.ai_requests;
CREATE POLICY ai_requests_insert ON public.ai_requests FOR INSERT
  WITH CHECK (
    handoff.has_permission(organization_id, 'ai:use')
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.id = requester_member_id AND m.user_id = (SELECT auth.uid())
    )
  );


-- ============================================================================
-- Part 2: Split '_manage' (FOR ALL) policies into INSERT, UPDATE, DELETE
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    v_roles text;
    v_using text;
    v_with_check text;
    v_base_name text;
BEGIN
    FOR r IN 
        SELECT tablename, policyname, roles, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public' 
          AND policyname LIKE '%_manage' 
          AND cmd = 'ALL'
    LOOP
        -- Extract base name by removing '_manage' suffix
        v_base_name := rtrim(r.policyname, '_manage');
        
        -- Formulate roles string
        IF r.roles = '{public}' THEN
            v_roles := 'public';
        ELSE
            v_roles := array_to_string(r.roles, ', ');
        END IF;

        -- Drop the old FOR ALL policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);

        -- 1. Create INSERT policy (requires WITH CHECK)
        v_with_check := COALESCE(r.with_check, r.qual);
        IF v_with_check IS NOT NULL THEN
            EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)', 
                v_base_name || '_insert', r.tablename, v_roles, v_with_check);
        END IF;

        -- 2. Create UPDATE policy (requires USING and optionally WITH CHECK)
        v_using := COALESCE(r.qual, r.with_check);
        IF v_using IS NOT NULL THEN
            IF r.with_check IS NOT NULL THEN
                EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)', 
                    v_base_name || '_update', r.tablename, v_roles, v_using, r.with_check);
            ELSE
                EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)', 
                    v_base_name || '_update', r.tablename, v_roles, v_using, v_using);
            END IF;
        END IF;

        -- 3. Create DELETE policy (requires USING)
        IF v_using IS NOT NULL THEN
            EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)', 
                v_base_name || '_delete', r.tablename, v_roles, v_using);
        END IF;

    END LOOP;
END $$;


-- ============================================================================
-- Part 3: Index all unindexed foreign keys
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    v_index_name text;
    v_sql text;
BEGIN
    FOR r IN 
        WITH fk_columns AS (
            SELECT 
                ns.nspname AS schema_name,
                t.relname AS table_name,
                c.conname AS fk_name,
                c.conkey AS fk_keys,
                c.conrelid AS table_oid
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace ns ON t.relnamespace = ns.oid
            WHERE c.contype = 'f' AND ns.nspname = 'public'
        )
        SELECT 
            f.schema_name, 
            f.table_name, 
            f.fk_name, 
            (
                SELECT array_to_string(array_agg(attname ORDER BY array_position(f.fk_keys, attnum)), ', ') 
                FROM pg_attribute 
                WHERE attrelid = f.table_oid AND attnum = ANY(f.fk_keys)
            ) AS fk_columns_list,
            (
                SELECT array_to_string(array_agg(attname ORDER BY array_position(f.fk_keys, attnum)), '_') 
                FROM pg_attribute 
                WHERE attrelid = f.table_oid AND attnum = ANY(f.fk_keys)
            ) AS fk_columns_suffix
        FROM fk_columns f
        WHERE NOT EXISTS (
            SELECT 1 
            FROM pg_index i
            WHERE i.indrelid = f.table_oid
              -- Check if the index starts with the foreign key columns
              AND (
                  SELECT array_agg(i.indkey[idx]) 
                  FROM generate_series(0, array_length(f.fk_keys, 1) - 1) AS idx
              ) = f.fk_keys
        )
    LOOP
        -- Construct a safe index name: idx_tablename_columns
        v_index_name := substring('idx_' || r.table_name || '_' || r.fk_columns_suffix FROM 1 FOR 63);
        
        -- Generate CREATE INDEX command
        v_sql := format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', 
            v_index_name, r.table_name, r.fk_columns_list);
            
        RAISE NOTICE 'Creating missing foreign key index: %', v_sql;
        EXECUTE v_sql;
    END LOOP;
END $$;
