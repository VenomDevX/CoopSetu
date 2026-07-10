-- ============================================================================
-- Handoff — seed.sql (local development data)
-- Demo password for every account: Password123!
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Demo auth users. We insert directly into auth.users + auth.identities so the
-- accounts can sign in with email/password locally. The on_auth_user_created
-- trigger creates the matching public.profiles rows.
-- ---------------------------------------------------------------------------
do $$
declare
  v record;
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v_member uuid;
  v_role uuid;
  users constant jsonb := '[
    {"id":"00000000-0000-0000-0000-000000000001","email":"admin@apexfintech.test","name":"Ava Admin","role":"ORG_ADMIN","title":"Head of Operations"},
    {"id":"00000000-0000-0000-0000-000000000002","email":"pm@apexfintech.test","name":"Pat Manager","role":"PROJECT_MANAGER","title":"Senior Project Manager"},
    {"id":"00000000-0000-0000-0000-000000000003","email":"dev@apexfintech.test","name":"Dev Rao","role":"DEVELOPER","title":"Backend Engineer"},
    {"id":"00000000-0000-0000-0000-000000000004","email":"qa@apexfintech.test","name":"Quinn Tester","role":"QA_ENGINEER","title":"QA Engineer"},
    {"id":"00000000-0000-0000-0000-000000000005","email":"sec@apexfintech.test","name":"Sam Secure","role":"SECURITY_ENGINEER","title":"Security Engineer"},
    {"id":"00000000-0000-0000-0000-000000000006","email":"audit@apexfintech.test","name":"Audrey Auditor","role":"AUDITOR","title":"Internal Auditor"},
    {"id":"00000000-0000-0000-0000-000000000007","email":"client@apexfintech.test","name":"Cleo Client","role":"CLIENT_VIEWER","title":"Client Stakeholder"},
    {"id":"00000000-0000-0000-0000-000000000008","email":"owner@apexfintech.test","name":"Olivia Owner","role":"ORG_OWNER","title":"Founder & CEO"},
    {"id":"00000000-0000-0000-0000-000000000009","email":"tm@apexfintech.test","name":"Tomas Lead","role":"TEAM_MANAGER","title":"Payments Team Manager"}
  ]'::jsonb;
begin
  -- Pass 1: create auth users + identities + profile job titles
  for v in select * from jsonb_array_elements(users) loop
    -- auth user
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    values (
      '00000000-0000-0000-0000-000000000000',
      (v.value->>'id')::uuid, 'authenticated', 'authenticated',
      v.value->>'email', crypt('Password123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v.value->>'name'),
      false, false)
    on conflict (id) do nothing;

    -- identity (required for password login)
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), (v.value->>'id')::uuid, v.value->>'id',
      jsonb_build_object('sub', v.value->>'id', 'email', v.value->>'email'),
      'email', now(), now(), now())
    on conflict do nothing;

    -- ensure profile job title
    update public.profiles set job_title = v.value->>'title'
      where id = (v.value->>'id')::uuid;

    -- GoTrue requires these token columns to be '' (not NULL) for password login
    update auth.users set
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      email_change_token_current = '',
      phone_change = '',
      phone_change_token = '',
      reauthentication_token = ''
    where id = (v.value->>'id')::uuid;
  end loop;

  -- Organization (created_by now exists)
  insert into public.organizations (id, name, slug, industry, timezone, created_by)
  values (v_org, 'Apex Financial Technologies', 'apex-financial-technologies', 'Fintech', 'UTC',
          '00000000-0000-0000-0000-000000000001')
  on conflict (id) do nothing;

  -- Pass 2: memberships + role assignments
  for v in select * from jsonb_array_elements(users) loop
    -- membership
    insert into public.organization_members (organization_id, user_id, employment_status, is_active)
    values (v_org, (v.value->>'id')::uuid, 'ACTIVE', true)
    on conflict (organization_id, user_id) do nothing
    returning id into v_member;

    if v_member is null then
      select id into v_member from public.organization_members
        where organization_id = v_org and user_id = (v.value->>'id')::uuid;
    end if;

    -- role assignment
    select id into v_role from public.roles where code = v.value->>'role' and organization_id is null;
    insert into public.member_roles (organization_member_id, role_id)
    values (v_member, v_role)
    on conflict do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Legal acceptance seed: every demo account has already accepted the active
-- Terms/Privacy/Cookies documents (migration 0075), so seeded logins reach
-- the dashboard directly instead of being routed through
-- /onboarding/legal-consent on every fresh `db reset`.
-- ---------------------------------------------------------------------------
do $$
declare
  v_user_id uuid;
  v_terms_id uuid;
  v_privacy_id uuid;
  v_cookies_id uuid;
  user_ids constant uuid[] := array[
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000009'
  ];
begin
  select id into v_terms_id from public.legal_documents
    where document_type = 'TERMS' and is_active = true limit 1;
  select id into v_privacy_id from public.legal_documents
    where document_type = 'PRIVACY' and is_active = true limit 1;
  select id into v_cookies_id from public.legal_documents
    where document_type = 'COOKIES' and is_active = true limit 1;

  if v_terms_id is not null and v_privacy_id is not null then
    foreach v_user_id in array user_ids loop
      insert into public.user_legal_acceptances (
        user_id, terms_document_id, privacy_document_id, cookies_document_id,
        accepted_cookies_at, acceptance_source, request_id
      ) values (
        v_user_id, v_terms_id, v_privacy_id, v_cookies_id,
        case when v_cookies_id is not null then now() else null end,
        'SEED', 'seed-' || v_user_id::text
      );
    end loop;
  end if;
end $$;

-- ============================================================================
-- Phase 2 seed: departments, teams, projects, milestones, risks
-- ============================================================================
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v_admin uuid; v_pm uuid; v_dev uuid; v_qa uuid; v_sec uuid;
  d record; t record; p record;
  v_dept uuid; v_proj uuid;
  depts constant text[] := array['Engineering','Product','QA','DevOps','Security','Compliance','Operations'];
  teams constant text[] := array['Payments Platform','Mobile Banking','Core Backend','Web Platform','QA Automation','Security Engineering','DevOps'];
  projects jsonb := '[
    {"name":"UPI Refund System","code":"UPI","priority":"HIGH","health":"AT_RISK"},
    {"name":"KYC Verification Upgrade","code":"KYC","priority":"HIGH","health":"ON_TRACK"},
    {"name":"Fraud Detection Engine","code":"FRAUD","priority":"CRITICAL","health":"ON_TRACK"},
    {"name":"Payment Gateway Migration","code":"PAY","priority":"CRITICAL","health":"OFF_TRACK"},
    {"name":"Mobile Banking Redesign","code":"MBR","priority":"MEDIUM","health":"ON_TRACK"},
    {"name":"Security Compliance Upgrade","code":"SEC","priority":"HIGH","health":"AT_RISK"},
    {"name":"Internal Admin Portal","code":"ADMIN","priority":"LOW","health":"ON_TRACK"}
  ]'::jsonb;
begin
  select id into v_admin from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000001';
  select id into v_pm    from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000002';
  select id into v_dev   from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000003';
  select id into v_qa    from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000004';
  select id into v_sec   from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000005';

  -- departments
  for i in 1..array_length(depts,1) loop
    insert into departments (organization_id, name, code, head_member_id)
    values (v_org, depts[i], upper(left(depts[i],3)), v_admin)
    on conflict (organization_id, name) do nothing;
  end loop;

  -- teams
  for i in 1..array_length(teams,1) loop
    insert into teams (organization_id, name, code, team_lead_member_id, capacity_hours_per_week)
    values (v_org, teams[i], 'T'||i, v_pm, 200)
    on conflict (organization_id, name) do nothing;
  end loop;

  -- projects + members + milestone + risk
  for p in select * from jsonb_array_elements(projects) loop
    insert into projects (organization_id, name, code, priority, health,
                          owner_member_id, project_manager_member_id, status, start_date, target_end_date)
    values (v_org, p.value->>'name', p.value->>'code', p.value->>'priority', p.value->>'health',
            v_admin, v_pm, 'ACTIVE', current_date - 30, current_date + 60)
    on conflict (organization_id, code) do nothing
    returning id into v_proj;

    if v_proj is null then
      select id into v_proj from projects where organization_id=v_org and code=p.value->>'code';
    end if;

    -- project members
    insert into project_members (project_id, organization_member_id, project_role, can_view, can_comment, can_edit, can_manage)
    values
      (v_proj, v_pm,  'Project Manager', true, true, true, true),
      (v_proj, v_dev, 'Developer',       true, true, true, false),
      (v_proj, v_qa,  'QA',              true, true, true, false),
      (v_proj, v_sec, 'Security',        true, true, false, false)
    on conflict (project_id, organization_member_id) do nothing;

    insert into milestones (project_id, title, due_date, status, owner_member_id)
    values (v_proj, 'Phase 1 Delivery', current_date + 20, 'IN_PROGRESS', v_pm)
    on conflict do nothing;

    insert into project_risks (project_id, title, risk_level, status, owner_member_id, mitigation_plan)
    values (v_proj, 'Integration dependency risk', 'HIGH', 'OPEN', v_pm, 'Coordinate with upstream team')
    on conflict do nothing;
  end loop;
end $$;

-- ============================================================================
-- Phase 3 seed: epics, sprints, tasks, assignees, comments
-- ============================================================================
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v_pm uuid; v_dev uuid; v_qa uuid; v_sec uuid;
  pr record;
  v_sprint uuid; v_task uuid; v_epic uuid;
  statuses text[] := array['BACKLOG','READY','IN_PROGRESS','IN_PROGRESS','CODE_REVIEW','QA_TESTING','BLOCKED','DONE','DONE','READY_FOR_RELEASE'];
  prios text[] := array['LOW','MEDIUM','HIGH','CRITICAL'];
  types text[] := array['TASK','STORY','BUG','IMPROVEMENT','SECURITY_TASK'];
  i int; st text; assignee uuid;
begin
  select id into v_pm  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000002';
  select id into v_dev from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000003';
  select id into v_qa  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000004';
  select id into v_sec from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000005';

  for pr in select id, code from projects where organization_id=v_org loop
    -- one active sprint per project
    insert into sprints (organization_id, project_id, name, goal, status, start_date, end_date, capacity_hours, planned_story_points)
    values (v_org, pr.id, pr.code||' Sprint 1', 'Deliver core scope', 'ACTIVE', current_date-7, current_date+7, 200, 40)
    returning id into v_sprint;

    -- one epic per project (so the Create-Task epic picker has real options)
    insert into epics (organization_id, project_id, title, description, status, priority, owner_member_id, start_date, target_end_date)
    values (v_org, pr.id, pr.code||' Core Delivery', 'Primary epic grouping the core scope for '||pr.code||'.',
            'IN_PROGRESS', 'HIGH', v_pm, current_date-7, current_date+30)
    returning id into v_epic;

    -- ~15 tasks per project
    for i in 1..15 loop
      st := statuses[1 + (i % array_length(statuses,1))];
      assignee := case (i % 3) when 0 then v_dev when 1 then v_qa else v_sec end;
      insert into tasks (organization_id, project_id, sprint_id, epic_id, title, description, task_type, status, priority,
                         reporter_member_id, primary_assignee_member_id, due_date, estimated_hours, story_points, position)
      values (v_org, pr.id, v_sprint, case when i <= 5 then v_epic else null end,
        pr.code||' work item '||i, 'Auto-seeded task for local development.',
        types[1+(i % array_length(types,1))], st, prios[1+(i % array_length(prios,1))],
        v_pm, assignee, current_date + (i % 14), 8, (i % 5)+1, i*1000)
      returning id into v_task;

      -- explicit assignee row (fires notification trigger)
      insert into task_assignees (task_id, organization_member_id, assigned_by)
      values (v_task, assignee, v_pm) on conflict do nothing;

      -- a couple comments on the first task of each project
      if i = 1 then
        insert into task_comments (organization_id, task_id, author_member_id, body)
        values (v_org, v_task, v_pm, 'Kicking this off — please prioritize.'),
               (v_org, v_task, v_dev, 'On it, will update by EOD.');
      end if;
    end loop;
  end loop;
end $$;

-- ============================================================================
-- Phase 5/6 seed: releases, approvals, bugs, security, compliance, incidents,
-- documents, integrations, repositories, PRs, pipelines, AI settings.
-- ============================================================================
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v_pm uuid; v_dev uuid; v_qa uuid; v_sec uuid; v_admin uuid;
  pr record; v_rel uuid; v_repo uuid; v_inc uuid; v_pipe uuid; i int;
begin
  select id into v_admin from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000001';
  select id into v_pm  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000002';
  select id into v_dev from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000003';
  select id into v_qa  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000004';
  select id into v_sec from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000005';

  -- environments
  insert into environments (organization_id, name, environment_type, is_production) values
    (v_org,'Development','DEVELOPMENT',false),
    (v_org,'Staging','STAGING',false),
    (v_org,'Production','PRODUCTION',true)
  on conflict do nothing;

  insert into approval_requests (organization_id, project_id, approval_type, requested_by_member_id, status)
  values (v_org, (select id from projects where organization_id=v_org limit 1), 'QA_REVIEW', v_pm, 'PENDING');

  -- ai settings
  insert into ai_settings (organization_id) values (v_org) on conflict do nothing;

  -- integrations
  insert into integrations (organization_id, provider, display_name, status) values
    (v_org,'github','GitHub','MOCK_CONNECTED'),
    (v_org,'slack','Slack','MOCK_CONNECTED'),
    (v_org,'datadog','Datadog','MOCK_CONNECTED'),
    (v_org,'pagerduty','PagerDuty','MOCK_CONNECTED')
  on conflict do nothing;

  for pr in select id, code from projects where organization_id=v_org loop
    -- repository + PRs + pipeline
    insert into repositories (organization_id, name, provider, url)
    values (v_org, lower(pr.code)||'-service', 'github', 'https://example.local/'||lower(pr.code))
    returning id into v_repo;

    for i in 1..3 loop
      insert into pull_requests (organization_id, repository_id, external_id, title, author_member_id,
        status, source_branch, target_branch, build_status, test_status)
      values (v_org, v_repo, 'PR-'||i, pr.code||' feature PR '||i, v_dev,
        case when i=3 then 'MERGED' else 'OPEN' end, 'feat/x'||i, 'main', 'PASSED','PASSED');
    end loop;

    insert into ci_pipelines (organization_id, repository_id, branch, status, triggered_by_member_id, completed_at)
    values (v_org, v_repo, 'main', 'PASSED', v_dev, now()) returning id into v_pipe;
    insert into ci_jobs (pipeline_id, name, status, duration_seconds) values
      (v_pipe,'build','PASSED',42),(v_pipe,'test','PASSED',91);

    -- release with approval gates
    insert into releases (organization_id, project_id, name, version, status, release_manager_member_id, requires_compliance_approval)
    values (v_org, pr.id, pr.code||' Release', 'v1.0', 'QA_PENDING', v_pm, (pr.code='SEC'))
    returning id into v_rel;
    insert into release_approvals (release_id, approval_type, required_role, status) values
      (v_rel,'QA','QA_ENGINEER','PENDING'),
      (v_rel,'SECURITY','SECURITY_ENGINEER','PENDING'),
      (v_rel,'RELEASE_MANAGER','PROJECT_MANAGER','PENDING');

    -- bugs
    insert into bugs (organization_id, project_id, title, severity, status, reporter_member_id, assignee_member_id)
    values
      (v_org, pr.id, pr.code||' login fails on retry', 'HIGH', 'OPEN', v_qa, v_dev),
      (v_org, pr.id, pr.code||' UI overflow on mobile', 'LOW', 'OPEN', v_qa, v_dev),
      (v_org, pr.id, pr.code||' data race in worker', 'CRITICAL', 'IN_PROGRESS', v_qa, v_dev);

    -- security review + finding
    insert into security_reviews (organization_id, project_id, title, status, risk_score, reviewer_member_id)
    values (v_org, pr.id, pr.code||' security review', 'PENDING', 60, v_sec);
    insert into security_findings (organization_id, project_id, title, severity, status, owner_member_id)
    values (v_org, pr.id, pr.code||' missing rate limit', 'MEDIUM', 'OPEN', v_sec);

    -- document
    insert into documents (organization_id, project_id, title, document_type, content_markdown, owner_member_id, status)
    values (v_org, pr.id, pr.code||' Technical Design', 'TECHNICAL_DESIGN', '# '||pr.code||' Design

Initial draft.', v_pm, 'DRAFT');
  end loop;

  -- compliance controls
  insert into compliance_controls (organization_id, name, framework_name, status, owner_member_id) values
    (v_org,'Access Reviews','SOC2','IN_PROGRESS',v_admin),
    (v_org,'Encryption at Rest','SOC2','COMPLIANT',v_admin),
    (v_org,'Change Management','ISO27001','IN_PROGRESS',v_admin);

  -- incidents
  for i in 1..5 loop
    insert into incidents (organization_id, title, severity, status, incident_commander_member_id, customer_impact)
    values (v_org, 'Incident '||i||': elevated error rate', case when i=1 then 'SEV1' else 'SEV3' end,
      case when i<=3 then 'RESOLVED' else 'INVESTIGATING' end, v_sec, 'Partial degradation')
    returning id into v_inc;
    insert into incident_timeline_events (incident_id, actor_member_id, event_type, message)
    values (v_inc, v_sec, 'DECLARED', 'Incident declared'),
           (v_inc, v_sec, 'UPDATE', 'Mitigation applied');
  end loop;
end $$;

-- ============================================================================
-- R1 seed: wire the Team Manager + a developer into the Payments Platform team
-- so is_team_manager() and team-scoped assignment are testable.
-- ============================================================================
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v_tm uuid; v_dev uuid; v_team uuid;
begin
  select id into v_tm  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000009';
  select id into v_dev from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000003';
  select id into v_team from teams where organization_id=v_org and name='Payments Platform';

  if v_team is not null then
    update teams set team_lead_member_id = v_tm where id = v_team;
    insert into team_members (team_id, organization_member_id, role_in_team)
    values (v_team, v_tm, 'MANAGER'), (v_team, v_dev, 'MEMBER')
    on conflict (team_id, organization_member_id) do nothing;

    -- Give the Team Manager view access to the UPI project so team-scoped
    -- task assignment is demonstrable (they can view but not manage the project).
    insert into project_members (project_id, organization_member_id, project_role, can_view, can_comment, can_edit, can_manage)
    select p.id, v_tm, 'Team Manager', true, true, false, false
    from projects p where p.organization_id = v_org and p.code = 'UPI'
    on conflict (project_id, organization_member_id) do nothing;

    -- Assign the team to the UPI project so team members get visibility via
    -- project_teams (team-on-project visibility), not just explicit membership.
    insert into project_teams (project_id, team_id, allocation_percent)
    select p.id, v_team, 100
    from projects p where p.organization_id = v_org and p.code = 'UPI'
    on conflict (project_id, team_id) do nothing;
  end if;
end $$;
