-- ============================================================================
-- CoopSetu â€” seed.sql (local development data)
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
    {"id":"00000000-0000-0000-0000-000000000001","email":"super@coopsetu.test","name":"NCCT Super Admin","role":"SUPER_ADMIN","title":"NCCT Authority"},
    {"id":"00000000-0000-0000-0000-000000000002","email":"admin@coopsetu.test","name":"Institute Admin","role":"INSTITUTE_ADMIN","title":"Institute Director"},
    {"id":"00000000-0000-0000-0000-000000000003","email":"trainer@coopsetu.test","name":"Expert Trainer","role":"TRAINER","title":"Senior Faculty"},
    {"id":"00000000-0000-0000-0000-000000000004","email":"trainee@coopsetu.test","name":"Student Trainee","role":"TRAINEE","title":"Batch 2026 Student"},
    {"id":"00000000-0000-0000-0000-000000000005","email":"employer@coopsetu.test","name":"Recruiting Employer","role":"EMPLOYER","title":"HR Director"},
    
    {"id":"00000000-0000-0000-0000-000000000011","email":"admin@apexfintech.test","name":"Ava Admin","role":"ORG_ADMIN","title":"Head of Operations"},
    {"id":"00000000-0000-0000-0000-000000000012","email":"pm@apexfintech.test","name":"Pat Manager","role":"PROJECT_MANAGER","title":"Senior Project Manager"},
    {"id":"00000000-0000-0000-0000-000000000013","email":"dev@apexfintech.test","name":"Dev Rao","role":"DEVELOPER","title":"Backend Engineer"},
    {"id":"00000000-0000-0000-0000-000000000014","email":"qa@apexfintech.test","name":"Quinn Tester","role":"QA_ENGINEER","title":"QA Engineer"},
    {"id":"00000000-0000-0000-0000-000000000015","email":"sec@apexfintech.test","name":"Sam Secure","role":"SECURITY_ENGINEER","title":"Security Engineer"},
    {"id":"00000000-0000-0000-0000-000000000016","email":"audit@apexfintech.test","name":"Audrey Auditor","role":"AUDITOR","title":"Internal Auditor"},
    {"id":"00000000-0000-0000-0000-000000000017","email":"client@apexfintech.test","name":"Cleo Client","role":"CLIENT_VIEWER","title":"Client Stakeholder"},
    {"id":"00000000-0000-0000-0000-000000000018","email":"owner@apexfintech.test","name":"Olivia Owner","role":"ORG_OWNER","title":"Founder & CEO"},
    {"id":"00000000-0000-0000-0000-000000000019","email":"tm@apexfintech.test","name":"Tomas Lead","role":"TEAM_MANAGER","title":"Payments Team Manager"}
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
      v.value->>'email', extensions.crypt('Password123!', extensions.gen_salt('bf')),
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

    -- ensure profile job title, username, and completion status
    update public.profiles 
      set job_title = v.value->>'title',
          username = case
            when length(split_part(v.value->>'email', '@', 1)) < 3
            then split_part(v.value->>'email', '@', 1) || '-user-' || split_part(split_part(v.value->>'email', '@', 2), '.', 1)
            else split_part(v.value->>'email', '@', 1) || '-' || split_part(split_part(v.value->>'email', '@', 2), '.', 1)
          end,
          username_normalized = lower(case
            when length(split_part(v.value->>'email', '@', 1)) < 3
            then split_part(v.value->>'email', '@', 1) || '-user-' || split_part(split_part(v.value->>'email', '@', 2), '.', 1)
            else split_part(v.value->>'email', '@', 1) || '-' || split_part(split_part(v.value->>'email', '@', 2), '.', 1)
          end),
          profile_completed_at = now()
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
  insert into public.organizations (id, name, slug, industry, timezone, created_by, initial_setup_completed_at)
  values (v_org, 'CoopSetu Training Network', 'coopsetu', 'Education', 'UTC',
          '00000000-0000-0000-0000-000000000001', now())
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
    if v_role is not null then
      insert into public.member_roles (organization_member_id, role_id)
      values (v_member, v_role)
      on conflict do nothing;
    end if;
  end loop;
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
  select id into v_admin from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000011';
  select id into v_pm    from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000012';
  select id into v_dev   from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000013';
  select id into v_qa    from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000014';
  select id into v_sec   from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000015';

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
  select id into v_pm  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000012';
  select id into v_dev from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000013';
  select id into v_qa  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000014';
  select id into v_sec from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000015';

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
        values (v_org, v_task, v_pm, 'Kicking this off â€” please prioritize.'),
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
  select id into v_admin from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000011';
  select id into v_pm  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000012';
  select id into v_dev from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000013';
  select id into v_qa  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000014';
  select id into v_sec from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000015';

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
  select id into v_tm  from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000019';
  select id into v_dev from organization_members where organization_id=v_org and user_id='00000000-0000-0000-0000-000000000013';
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

-- Register the trainee@coopsetu.test demo account in the trainees table so
-- trainee-scoped features (courses, certificates, skill passport, job
-- applications, etc.) work out of the box for that persona. (This block used
-- to mistakenly register user 000...003 — trainer@coopsetu.test — under a
-- stale "dev@apexfintech.test" comment; that account is a TRAINER, not the
-- TRAINEE demo user, so it never belonged here.)
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v_trainee uuid := '00000000-0000-0000-0000-000000000004'; -- trainee@coopsetu.test
begin
  insert into public.trainees (user_id, organization_id, status)
  values (v_trainee, v_org, 'ACTIVE')
  on conflict do nothing;
end $$;


-- ============================================================================
-- NCCT ecosystem seed (PS 26087)
--
-- The real institutional structure the problem statement describes:
--
--     NCCT (national apex)
--       └── VAMNICOM, Pune                    (APEX)
--             ├── RICM Bengaluru              (REGIONAL)
--             │     └── ICM Lucknow           (INSTITUTE)
--             └── RICM Chandigarh             (REGIONAL)
--                   └── ICM Bhopal            (INSTITUTE)
--
-- Every account below signs in with Password123!, same as the accounts above.
-- Institute staff are pinned to their institute via organization_members
-- .institution_id, so 0085's restrictive policies scope them; the NCCT director
-- is left NULL, which means national scope.
--
-- Idempotent throughout: institutions.code is GLOBALLY unique (0071), so a
-- second `supabase db reset` against a live database would otherwise collide.
-- ============================================================================
do $$
declare
  v_org      uuid := '00000000-0000-0000-0000-0000000000a0'; -- CoopSetu Training Network
  v_member   uuid;
  v_role     uuid;
  v          record;

  -- institutions
  v_ncct     uuid := '00000000-0000-0000-0000-0000000000c1';
  v_vamnicom uuid := '00000000-0000-0000-0000-0000000000c2';
  v_ricm_blr uuid := '00000000-0000-0000-0000-0000000000c3';
  v_ricm_chd uuid := '00000000-0000-0000-0000-0000000000c4';
  v_icm_lko  uuid := '00000000-0000-0000-0000-0000000000c5';
  v_icm_bpl  uuid := '00000000-0000-0000-0000-0000000000c6';

  users jsonb := '[
    {"id":"00000000-0000-0000-0000-0000000000b1","email":"ncct.director@coopsetu.test","name":"Dr. Meena Raghavan","role":"SUPER_ADMIN","title":"Director General, NCCT","inst":null},
    {"id":"00000000-0000-0000-0000-0000000000b2","email":"vamnicom.director@coopsetu.test","name":"Dr. Anil Deshmukh","role":"INSTITUTE_ADMIN","title":"Director, VAMNICOM","inst":"00000000-0000-0000-0000-0000000000c2"},
    {"id":"00000000-0000-0000-0000-0000000000b3","email":"ricm.bengaluru@coopsetu.test","name":"Lakshmi Narayan","role":"INSTITUTE_ADMIN","title":"Principal, RICM Bengaluru","inst":"00000000-0000-0000-0000-0000000000c3"},
    {"id":"00000000-0000-0000-0000-0000000000b4","email":"ricm.chandigarh@coopsetu.test","name":"Harpreet Kaur","role":"INSTITUTE_ADMIN","title":"Principal, RICM Chandigarh","inst":"00000000-0000-0000-0000-0000000000c4"},
    {"id":"00000000-0000-0000-0000-0000000000b5","email":"icm.lucknow@coopsetu.test","name":"Ravi Shankar Tiwari","role":"INSTITUTE_ADMIN","title":"Principal, ICM Lucknow","inst":"00000000-0000-0000-0000-0000000000c5"},
    {"id":"00000000-0000-0000-0000-0000000000b6","email":"icm.bhopal@coopsetu.test","name":"Sneha Chouhan","role":"INSTITUTE_ADMIN","title":"Principal, ICM Bhopal","inst":"00000000-0000-0000-0000-0000000000c6"},
    {"id":"00000000-0000-0000-0000-0000000000b7","email":"trainer.vamnicom@coopsetu.test","name":"Prof. Sudhir Kulkarni","role":"TRAINER","title":"Faculty, Cooperative Management","inst":"00000000-0000-0000-0000-0000000000c2"},
    {"id":"00000000-0000-0000-0000-0000000000b8","email":"trainer.icm@coopsetu.test","name":"Anita Verma","role":"TRAINER","title":"Faculty, Rural Banking","inst":"00000000-0000-0000-0000-0000000000c5"},
    {"id":"00000000-0000-0000-0000-0000000000b9","email":"trainee.aman@coopsetu.test","name":"Aman Yadav","role":"TRAINEE","title":"Trainee","inst":"00000000-0000-0000-0000-0000000000c5"},
    {"id":"00000000-0000-0000-0000-0000000000ba","email":"trainee.sunita@coopsetu.test","name":"Sunita Devi","role":"TRAINEE","title":"Trainee","inst":"00000000-0000-0000-0000-0000000000c5"},
    {"id":"00000000-0000-0000-0000-0000000000bb","email":"trainee.rahul@coopsetu.test","name":"Rahul Meshram","role":"TRAINEE","title":"Trainee","inst":"00000000-0000-0000-0000-0000000000c6"},
    {"id":"00000000-0000-0000-0000-0000000000bc","email":"employer.iffco@coopsetu.test","name":"Priya Nair","role":"EMPLOYER","title":"HR Manager, IFFCO","inst":null},
    {"id":"00000000-0000-0000-0000-0000000000bd","email":"employer.amul@coopsetu.test","name":"Kiran Patel","role":"EMPLOYER","title":"Talent Lead, Amul","inst":null}
  ]'::jsonb;
begin
  -- ---- auth users (same three-step dance as the block at the top of this file:
  -- ---- auth.users, then auth.identities, then blanking the GoTrue token
  -- ---- columns. Skip the third step and password login fails silently.)
  for v in select * from jsonb_array_elements(users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    values (
      '00000000-0000-0000-0000-000000000000',
      (v.value->>'id')::uuid, 'authenticated', 'authenticated',
      v.value->>'email', extensions.crypt('Password123!', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v.value->>'name'),
      false, false)
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), (v.value->>'id')::uuid, v.value->>'id',
      jsonb_build_object('sub', v.value->>'id', 'email', v.value->>'email'),
      'email', now(), now(), now())
    on conflict do nothing;

    update public.profiles
      set job_title = v.value->>'title',
          username = split_part(v.value->>'email', '@', 1) || '-coopsetu',
          username_normalized = lower(split_part(v.value->>'email', '@', 1) || '-coopsetu'),
          profile_completed_at = now()
      where id = (v.value->>'id')::uuid;

    update auth.users set
      confirmation_token = '', recovery_token = '',
      email_change_token_new = '', email_change = '',
      email_change_token_current = '', phone_change = '',
      phone_change_token = '', reauthentication_token = ''
    where id = (v.value->>'id')::uuid;
  end loop;

  -- ---- the institution tree (parents before children; the self-FK requires it)
  insert into public.institutions (id, organization_id, name, code, type, level, parent_institution_id, city, state, capacity, contact_email)
  values
    (v_ncct,     v_org, 'National Council for Cooperative Training',            'NCCT',            'NCCT',     'NATIONAL', null,       'New Delhi',  'Delhi',          0,    'contact@ncct.gov.in'),
    (v_vamnicom, v_org, 'Vaikunth Mehta National Institute of Cooperative Mgmt','VAMNICOM-PUNE',   'VAMNICOM', 'APEX',     v_ncct,     'Pune',       'Maharashtra',    600,  'info@vamnicom.gov.in'),
    (v_ricm_blr, v_org, 'Regional Institute of Cooperative Management, Bengaluru','RICM-BENGALURU','RICM',     'REGIONAL', v_vamnicom, 'Bengaluru',  'Karnataka',      320,  'info@ricmbengaluru.in'),
    (v_ricm_chd, v_org, 'Regional Institute of Cooperative Management, Chandigarh','RICM-CHANDIGARH','RICM',   'REGIONAL', v_vamnicom, 'Chandigarh', 'Punjab',         280,  'info@ricmchandigarh.in'),
    (v_icm_lko,  v_org, 'Institute of Cooperative Management, Lucknow',         'ICM-LUCKNOW',     'ICM',      'INSTITUTE',v_ricm_blr, 'Lucknow',    'Uttar Pradesh',  180,  'info@icmlucknow.in'),
    (v_icm_bpl,  v_org, 'Institute of Cooperative Management, Bhopal',          'ICM-BHOPAL',      'ICM',      'INSTITUTE',v_ricm_chd, 'Bhopal',     'Madhya Pradesh', 150,  'info@icmbhopal.in')
  on conflict (id) do nothing;

  -- ---- memberships, roles, institute pinning
  for v in select * from jsonb_array_elements(users) loop
    insert into public.organization_members (organization_id, user_id, employment_status, is_active, job_title, institution_id)
    values (v_org, (v.value->>'id')::uuid, 'ACTIVE', true, v.value->>'title',
            nullif(v.value->>'inst','')::uuid)
    on conflict (organization_id, user_id) do update
      set institution_id = excluded.institution_id
    returning id into v_member;

    if v_member is null then
      select id into v_member from public.organization_members
        where organization_id = v_org and user_id = (v.value->>'id')::uuid;
    end if;

    select id into v_role from public.roles
      where code = v.value->>'role' and organization_id is null;
    if v_role is not null then
      insert into public.member_roles (organization_member_id, role_id)
      values (v_member, v_role) on conflict do nothing;
    end if;
  end loop;

  -- ---- institute heads (denormalised for the tree view; the membership row
  -- ---- above is still the authoritative link)
  update public.institutions set head_user_id = '00000000-0000-0000-0000-0000000000b2' where id = v_vamnicom;
  update public.institutions set head_user_id = '00000000-0000-0000-0000-0000000000b3' where id = v_ricm_blr;
  update public.institutions set head_user_id = '00000000-0000-0000-0000-0000000000b4' where id = v_ricm_chd;
  update public.institutions set head_user_id = '00000000-0000-0000-0000-0000000000b5' where id = v_icm_lko;
  update public.institutions set head_user_id = '00000000-0000-0000-0000-0000000000b6' where id = v_icm_bpl;

  -- ---- trainers
  insert into public.trainers (user_id, organization_id, institution_id, specialization, qualification, experience_years, status)
  values
    ('00000000-0000-0000-0000-0000000000b7', v_org, v_vamnicom, 'Cooperative Management', 'Ph.D. Cooperative Management', 14, 'ACTIVE'),
    ('00000000-0000-0000-0000-0000000000b8', v_org, v_icm_lko,  'Rural Banking & Credit', 'M.Com, CAIIB',                  9, 'ACTIVE')
  on conflict (user_id, organization_id) do nothing;

  -- ---- trainees
  insert into public.trainees (user_id, organization_id, institution_id, education, location, languages, digital_literacy_level, employment_status, gender, status)
  values
    ('00000000-0000-0000-0000-0000000000b9', v_org, v_icm_lko, 'B.A. Rural Studies',  'Barabanki, Uttar Pradesh', '{"Hindi","English"}',  'BASIC',        'UNEMPLOYED', 'MALE',   'ACTIVE'),
    ('00000000-0000-0000-0000-0000000000ba', v_org, v_icm_lko, '12th Pass',           'Sitapur, Uttar Pradesh',   '{"Hindi"}',            'BASIC',        'UNEMPLOYED', 'FEMALE', 'ACTIVE'),
    ('00000000-0000-0000-0000-0000000000bb', v_org, v_icm_bpl, 'B.Sc. Agriculture',   'Sehore, Madhya Pradesh',   '{"Hindi","English"}',  'INTERMEDIATE', 'SELF_EMPLOYED','MALE', 'ACTIVE')
  on conflict (user_id, organization_id) do nothing;

  -- ---- employers
  insert into public.employers (user_id, organization_id, company_name, industry, location, status)
  values
    ('00000000-0000-0000-0000-0000000000bc', v_org, 'IFFCO', 'Cooperative / Fertilisers', 'New Delhi', 'ACTIVE'),
    ('00000000-0000-0000-0000-0000000000bd', v_org, 'Amul (GCMMF)', 'Dairy Cooperative',  'Anand, Gujarat', 'ACTIVE')
  on conflict do nothing;
end $$;

-- ============================================================================
-- RFID card for the NCCT director's attendance terminal card (physical UID
-- D7:02:73:06, stored uppercase/no-separators to match how the terminal
-- firmware and /api/v1/attendance/rfid both normalise UIDs).
-- ============================================================================
do $$
declare
  v_org    uuid := '00000000-0000-0000-0000-0000000000a0';
  v_member uuid;
begin
  select id into v_member from public.organization_members
    where organization_id = v_org
      and user_id = '00000000-0000-0000-0000-0000000000b1'; -- ncct.director@coopsetu.test

  if v_member is not null then
    insert into public.rfid_cards (organization_id, institution_id, member_id, rfid_uid, status, registered_at)
    values (v_org, null, v_member, 'D7027306', 'ACTIVE', now())
    on conflict (rfid_uid) do nothing;
  end if;
end $$;


-- ============================================================================
-- Learning content for the NCCT programme
--
-- Gives the lesson player (components/learning/module-player.tsx) something
-- real to render: a narrated video, two authored text lessons and a PDF. The
-- text bodies are full lessons rather than lorem, because they are what a judge
-- actually reads when they open the course.
--
-- The video and PDF are public sample assets over https. Course content in a
-- real deployment is institute-hosted; middleware.ts's media-src/frame-src
-- allow https: for exactly that reason.
-- ============================================================================
do $$
declare
  v_org       uuid := '00000000-0000-0000-0000-0000000000a0';
  v_icm_lko   uuid := '00000000-0000-0000-0000-0000000000c5';
  v_trainer   uuid;
  v_programme uuid := '00000000-0000-0000-0000-0000000000d1';
  v_course    uuid := '00000000-0000-0000-0000-0000000000d2';
  v_batch     uuid := '00000000-0000-0000-0000-0000000000d3';
begin
  select id into v_trainer from public.trainers
   where user_id = '00000000-0000-0000-0000-0000000000b8' and organization_id = v_org;

  insert into public.programmes (id, organization_id, institution_id, title, description, duration_days, capacity, fee, status, start_date, end_date)
  values (v_programme, v_org, v_icm_lko,
          'Cooperative Management Foundation',
          'Governance of primary agricultural credit societies, cooperative audit basics, and the digital tools a PACS secretary uses day to day.',
          45, 40, 0, 'ACTIVE', current_date - 5, current_date + 40)
  on conflict (id) do nothing;

  insert into public.batches (id, organization_id, programme_id, trainer_id, name, start_date, end_date, capacity, status, room)
  values (v_batch, v_org, v_programme, v_trainer, 'CMF-2026-LKO-01',
          current_date - 5, current_date + 40, 40, 'ACTIVE', 'Hall A')
  on conflict (id) do nothing;

  -- courses reach the organization through programme_id; there is no
  -- organization_id column on this table.
  insert into public.courses (id, programme_id, trainer_id, title, description, duration_hours, order_index, status)
  values (v_course, v_programme, v_trainer,
          'Cooperative Governance Essentials',
          'What a cooperative is, who is accountable for what, and how members hold a society to account.',
          12, 1, 'ACTIVE')
  on conflict (id) do nothing;

  insert into public.course_modules (course_id, title, type, content_url, content_text, duration_minutes, order_index, is_mandatory)
  values
    (v_course, 'Welcome and how this course works', 'VIDEO',
     'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', null, 3, 1, true),

    (v_course, 'What makes an organisation a cooperative', 'TEXT', null,
E'A cooperative is an autonomous association of persons united voluntarily to meet their common economic, social and cultural needs through a jointly owned and democratically controlled enterprise.\n\nThat definition carries four commitments worth separating out.\n\n1. VOLUNTARY AND OPEN MEMBERSHIP\nMembership is open to anyone able to use the society''s services and willing to accept the responsibilities of belonging. A society may not refuse membership on grounds of gender, social status, race, political affiliation or religion.\n\n2. DEMOCRATIC MEMBER CONTROL\nOne member, one vote — regardless of shareholding. This is the sharpest difference between a cooperative and a company. In a company, control follows capital; in a cooperative, control follows membership. A member holding fifty shares has exactly the same voice at the general body as a member holding one.\n\n3. MEMBER ECONOMIC PARTICIPATION\nMembers contribute equitably to the capital of their cooperative and control it democratically. Surplus is not distributed in proportion to shareholding but in proportion to use — a farmer who sold more milk to the dairy receives a larger patronage bonus.\n\n4. AUTONOMY AND INDEPENDENCE\nWhen a cooperative enters into an agreement with government or raises capital externally, it must do so on terms that preserve democratic control by its members.\n\nWHY THIS MATTERS IN PRACTICE\nA PACS secretary who understands these principles can answer the questions that actually arise at a general body meeting: why a large depositor cannot demand a second vote, why the surplus was distributed the way it was, and why the society''s books are open to any member who asks.\n\nThe next lesson covers who is accountable for what, and what the Registrar can and cannot direct a society to do.',
     18, 2, true),

    (v_course, 'Accountability: board, secretary, Registrar', 'TEXT', null,
E'Three roles carry statutory weight in a primary cooperative society, and confusing them is the most common cause of audit objections.\n\nTHE MANAGING COMMITTEE (BOARD)\nElected by the general body. Collectively responsible for the society''s decisions: sanctioning loans within limits, approving the budget, and appointing staff. Individual committee members have no executive authority acting alone — a resolution of the committee is the instrument, not the wish of its chair.\n\nTHE SECRETARY\nThe society''s executive officer. Maintains the books, gives effect to committee resolutions, and is answerable for the accuracy of records. The secretary does not decide policy; a secretary who sanctions a loan without a committee resolution has exceeded their authority regardless of how sound the loan is.\n\nTHE REGISTRAR OF COOPERATIVE SOCIETIES\nA statutory authority, not a member of the society. The Registrar registers societies, orders audits and inquiries, and can supersede a committee in defined circumstances. What the Registrar cannot do is manage the society''s day-to-day business or override the general body on matters the Act leaves to members.\n\nA WORKED EXAMPLE\nA member applies for a crop loan of Rs 80,000. The by-laws allow the secretary to sanction up to Rs 25,000. The correct sequence is: application recorded, placed before the managing committee, committee resolution passed and minuted, secretary disburses against that resolution and records it.\n\nSkipping the resolution is the single most frequent finding in cooperative audit — not because the money was misused, but because the authority to lend it was never properly created.',
     22, 3, true),

    (v_course, 'Model by-laws — reference PDF', 'PDF',
     'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', null, 15, 4, false)
  on conflict do nothing;

  -- Enrol the three seeded trainees so the player has progress to record and
  -- the trainer's batch roster is not empty.
  insert into public.enrollments (trainee_id, programme_id, batch_id, status, source, enrolled_at)
  select t.id, v_programme, v_batch, 'ENROLLED', 'NOMINATED', now()
    from public.trainees t
   where t.organization_id = v_org
     and t.user_id in ('00000000-0000-0000-0000-0000000000b9',
                       '00000000-0000-0000-0000-0000000000ba',
                       '00000000-0000-0000-0000-0000000000bb')
  on conflict (trainee_id, programme_id) do nothing;
end $$;


-- ============================================================================
-- Attendance terminal credential
--
-- Lives here rather than in migration 0088 because migrations run before the
-- seed: at 0088 the institutions table is still empty, so an INSERT..SELECT
-- keyed on ICM-LUCKNOW matched nothing and silently produced no row.
--
-- The plaintext is committed deliberately — this is a local demo environment,
-- and firmware/CoopSetuTerminal/config.h needs a value to authenticate with.
-- Real deployments mint a token through the API and see the plaintext once.
--
--   token: coopsetu-device-icm-lucknow-demo
-- ============================================================================
insert into public.device_tokens (organization_id, institution_id, label, token_hash, token_hint)
select '00000000-0000-0000-0000-0000000000a0', i.id,
       'ICM Lucknow - entrance terminal',
       encode(extensions.digest('coopsetu-device-icm-lucknow-demo', 'sha256'), 'hex'),
       'demo'
  from public.institutions i
 where i.code = 'ICM-LUCKNOW'
on conflict (token_hash) do nothing;


-- ============================================================================
-- Hindi translations for the seeded course
--
-- Matched on the base row's title rather than a hardcoded id, so this survives
-- the course being reseeded with a new uuid.
--
-- The PDF module is deliberately left untranslated. That is the point of the
-- fallback: an untranslated module still renders in the source language rather
-- than disappearing from the course, and a judge switching to Hindi can see
-- both behaviours in one screen.
-- ============================================================================
do $$
declare
  v_course uuid := '00000000-0000-0000-0000-0000000000d2';
begin
  insert into public.course_translations (course_id, locale, title, description)
  values (v_course, 'hi',
          'सहकारी अभिशासन की मूल बातें',
          'सहकारी संस्था क्या होती है, किसकी क्या जवाबदेही है, और सदस्य समिति से उत्तरदायित्व कैसे माँगते हैं।')
  on conflict (course_id, locale) do nothing;

  insert into public.course_module_translations (module_id, locale, title, content_text)
  select m.id, 'hi', 'स्वागत और यह पाठ्यक्रम कैसे चलेगा', null
    from public.course_modules m
   where m.course_id = v_course and m.title = 'Welcome and how this course works'
  on conflict (module_id, locale) do nothing;

  insert into public.course_module_translations (module_id, locale, title, content_text)
  select m.id, 'hi', 'कोई संस्था सहकारी कब कहलाती है',
E'सहकारी संस्था व्यक्तियों का एक स्वायत्त संघ है, जो स्वेच्छा से जुड़कर अपनी साझा आर्थिक, सामाजिक और सांस्कृतिक आवश्यकताओं की पूर्ति एक संयुक्त स्वामित्व वाले तथा लोकतांत्रिक रूप से नियंत्रित उद्यम के माध्यम से करता है।\n\nइस परिभाषा में चार प्रतिबद्धताएँ छिपी हैं, जिन्हें अलग-अलग समझना ज़रूरी है।\n\n1. स्वैच्छिक और खुली सदस्यता\nसदस्यता हर उस व्यक्ति के लिए खुली है जो समिति की सेवाओं का उपयोग कर सके और सदस्य होने के दायित्व स्वीकार करने को तैयार हो। कोई समिति लिंग, सामाजिक स्थिति, जाति, राजनीतिक संबद्धता या धर्म के आधार पर सदस्यता से मना नहीं कर सकती।\n\n2. लोकतांत्रिक सदस्य नियंत्रण\nएक सदस्य, एक मत — चाहे उसके पास कितने भी शेयर हों। कंपनी और सहकारी संस्था के बीच यही सबसे बड़ा अंतर है। कंपनी में नियंत्रण पूँजी के पीछे चलता है; सहकारी संस्था में नियंत्रण सदस्यता के पीछे चलता है। पचास शेयर रखने वाले सदस्य की आवाज़ आम सभा में उतनी ही है, जितनी एक शेयर रखने वाले सदस्य की।\n\n3. सदस्यों की आर्थिक भागीदारी\nसदस्य अपनी समिति की पूँजी में समान रूप से योगदान करते हैं और उस पर लोकतांत्रिक नियंत्रण रखते हैं। लाभांश शेयरधारिता के अनुपात में नहीं, बल्कि उपयोग के अनुपात में बाँटा जाता है — जिस किसान ने डेयरी को अधिक दूध दिया, उसे अधिक संरक्षण बोनस मिलता है।\n\n4. स्वायत्तता और स्वतंत्रता\nजब कोई सहकारी संस्था सरकार के साथ समझौता करती है या बाहर से पूँजी जुटाती है, तो शर्तें ऐसी होनी चाहिए कि सदस्यों का लोकतांत्रिक नियंत्रण बना रहे।\n\nव्यवहार में यह क्यों मायने रखता है\nजो पैक्स सचिव इन सिद्धांतों को समझता है, वह आम सभा में उठने वाले असली सवालों का उत्तर दे सकता है: बड़ा जमाकर्ता दूसरा मत क्यों नहीं माँग सकता, लाभांश उसी तरह क्यों बँटा, और समिति की बहियाँ हर सदस्य के लिए खुली क्यों हैं।\n\nअगले पाठ में यह देखेंगे कि किसकी क्या जवाबदेही है, और रजिस्ट्रार किसी समिति को क्या निर्देश दे सकता है और क्या नहीं।'
    from public.course_modules m
   where m.course_id = v_course and m.title = 'What makes an organisation a cooperative'
  on conflict (module_id, locale) do nothing;

  insert into public.course_module_translations (module_id, locale, title, content_text)
  select m.id, 'hi', 'जवाबदेही: समिति, सचिव और रजिस्ट्रार',
E'प्राथमिक सहकारी समिति में तीन भूमिकाओं का वैधानिक महत्व है, और इन्हें आपस में गड्डमड्ड कर देना अंकेक्षण आपत्तियों का सबसे आम कारण है।\n\nप्रबंध समिति\nआम सभा द्वारा निर्वाचित। समिति के निर्णयों के लिए सामूहिक रूप से उत्तरदायी: सीमा के भीतर ऋण स्वीकृत करना, बजट अनुमोदित करना और कर्मचारियों की नियुक्ति। किसी एक सदस्य के पास अकेले कार्यकारी अधिकार नहीं होता — साधन समिति का प्रस्ताव है, अध्यक्ष की इच्छा नहीं।\n\nसचिव\nसमिति का कार्यकारी अधिकारी। बहियाँ रखता है, समिति के प्रस्तावों को लागू करता है, और अभिलेखों की शुद्धता के लिए उत्तरदायी है। सचिव नीति तय नहीं करता; जिस सचिव ने समिति के प्रस्ताव के बिना ऋण स्वीकृत किया, उसने अपने अधिकार का अतिक्रमण किया है — भले ही ऋण कितना भी उचित क्यों न हो।\n\nसहकारी समितियों का रजिस्ट्रार\nएक वैधानिक प्राधिकारी, समिति का सदस्य नहीं। समितियों का पंजीकरण करता है, अंकेक्षण और जाँच के आदेश देता है, और निर्धारित परिस्थितियों में समिति को अधिक्रांत कर सकता है। रजिस्ट्रार जो नहीं कर सकता, वह है समिति का रोज़मर्रा का कामकाज चलाना या उन विषयों पर आम सभा को दरकिनार करना जो अधिनियम ने सदस्यों के लिए छोड़े हैं।\n\nएक उदाहरण\nकोई सदस्य 80,000 रुपये के फसल ऋण के लिए आवेदन करता है। उपविधि सचिव को 25,000 रुपये तक स्वीकृत करने की अनुमति देती है। सही क्रम यह है: आवेदन दर्ज हो, प्रबंध समिति के समक्ष रखा जाए, समिति का प्रस्ताव पारित और कार्यवृत्त में दर्ज हो, फिर सचिव उसी प्रस्ताव के आधार पर राशि वितरित करे और उसे अभिलिखित करे।\n\nप्रस्ताव को छोड़ देना सहकारी अंकेक्षण की सबसे बार-बार मिलने वाली आपत्ति है — इसलिए नहीं कि धन का दुरुपयोग हुआ, बल्कि इसलिए कि ऋण देने का अधिकार ही कभी विधिवत सृजित नहीं हुआ।'
    from public.course_modules m
   where m.course_id = v_course and m.title = 'Accountability: board, secretary, Registrar'
  on conflict (module_id, locale) do nothing;
end $$;


-- ============================================================================
-- Issued certificates
--
-- Gives the public verification page (/verify/<number>) something real to
-- confirm, and the skill passport something to show. Two ACTIVE and one
-- REVOKED, because "revoked" is the answer a verifier most needs to trust and
-- the one most likely to be broken without a fixture proving it.
--
-- qr_code stores the URL the printed QR encodes, not the number again — that
-- is what closes the scan-to-verify loop.
-- ============================================================================
do $$
declare
  v_org       uuid := '00000000-0000-0000-0000-0000000000a0';
  v_programme uuid := '00000000-0000-0000-0000-0000000000d1';
  v_aman      uuid;
  v_sunita    uuid;
  v_rahul     uuid;
begin
  select id into v_aman   from public.trainees where user_id = '00000000-0000-0000-0000-0000000000b9' and organization_id = v_org;
  select id into v_sunita from public.trainees where user_id = '00000000-0000-0000-0000-0000000000ba' and organization_id = v_org;
  select id into v_rahul  from public.trainees where user_id = '00000000-0000-0000-0000-0000000000bb' and organization_id = v_org;

  insert into public.certificates (trainee_id, programme_id, certificate_number, title, issued_at, valid_until, issuer_name, qr_code, status)
  values
    (v_aman,   v_programme, 'CERT-NCCT-2026-000101', 'Cooperative Management Foundation',
     now() - interval '20 days', now() + interval '5 years', 'NCCT',
     'https://coopsetu.in/verify/CERT-NCCT-2026-000101', 'ACTIVE'),
    (v_sunita, v_programme, 'CERT-NCCT-2026-000102', 'Cooperative Management Foundation',
     now() - interval '18 days', now() + interval '5 years', 'NCCT',
     'https://coopsetu.in/verify/CERT-NCCT-2026-000102', 'ACTIVE'),
    (v_rahul,  v_programme, 'CERT-NCCT-2026-000103', 'Cooperative Management Foundation',
     now() - interval '2 years', now() + interval '3 years', 'NCCT',
     'https://coopsetu.in/verify/CERT-NCCT-2026-000103', 'REVOKED')
  on conflict (certificate_number) do nothing;
end $$;


-- ============================================================================
-- NCCT environment — population
--
-- The environment was almost empty: 3 trainees, 1 programme, 1 batch, 1 course,
-- and zero rows in assessments, results, progress, attendance, jobs and skills.
-- Every chart and KPI was rendering against an empty set.
--
-- This block builds a plausible national deployment: 20 trainees across all five
-- institutes, 7 programmes, 12 batches, 9 courses, 45+ modules, real assessment
-- scores, and 90 days of learning history.
--
-- History is GENERATED, not enumerated — generate_series plus a fixed seed, so
-- seed.sql stays readable and `db reset` stays quick. setseed() makes it
-- reproducible: the same reset always produces the same demo.
--
-- UUID namespaces, chosen to stay clear of the existing ...0b1-0bd / 0c1-0c6 /
-- 0d1-0d3 blocks:
--   e001-e011  trainee auth users      f101-f107  programmes
--   f201-f20c  batches                 f301-f309  courses
--   f401-f408  assessments
-- ============================================================================

-- ---------------------------------------------------------------- trainees
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v     record;
  people jsonb := '[
    {"n":1, "name":"Kavita Sharma",     "inst":"c5","edu":"B.A. Sociology",        "loc":"Barabanki, Uttar Pradesh","g":"FEMALE","lit":"BASIC"},
    {"n":2, "name":"Deepak Nishad",     "inst":"c5","edu":"12th Pass",             "loc":"Gonda, Uttar Pradesh",    "g":"MALE",  "lit":"BASIC"},
    {"n":3, "name":"Pooja Maurya",      "inst":"c5","edu":"B.Com",                 "loc":"Sitapur, Uttar Pradesh",  "g":"FEMALE","lit":"INTERMEDIATE"},
    {"n":4, "name":"Vikas Chaurasia",   "inst":"c5","edu":"B.Sc. Agriculture",     "loc":"Hardoi, Uttar Pradesh",   "g":"MALE",  "lit":"INTERMEDIATE"},
    {"n":5, "name":"Anjali Verma",      "inst":"c5","edu":"M.A. Rural Development","loc":"Lucknow, Uttar Pradesh",  "g":"FEMALE","lit":"ADVANCED"},
    {"n":6, "name":"Rakesh Ahirwar",    "inst":"c6","edu":"12th Pass",             "loc":"Sehore, Madhya Pradesh",  "g":"MALE",  "lit":"BASIC"},
    {"n":7, "name":"Meena Lodhi",       "inst":"c6","edu":"B.A. Economics",        "loc":"Vidisha, Madhya Pradesh", "g":"FEMALE","lit":"BASIC"},
    {"n":8, "name":"Suresh Yadav",      "inst":"c6","edu":"B.Com",                 "loc":"Raisen, Madhya Pradesh",  "g":"MALE",  "lit":"INTERMEDIATE"},
    {"n":9, "name":"Geeta Patel",       "inst":"c6","edu":"Diploma Dairy Tech",    "loc":"Bhopal, Madhya Pradesh",  "g":"FEMALE","lit":"INTERMEDIATE"},
    {"n":10,"name":"Manoj Gowda",       "inst":"c3","edu":"B.Sc. Agriculture",     "loc":"Mandya, Karnataka",       "g":"MALE",  "lit":"INTERMEDIATE"},
    {"n":11,"name":"Lakshmi Devi",      "inst":"c3","edu":"12th Pass",             "loc":"Hassan, Karnataka",       "g":"FEMALE","lit":"BASIC"},
    {"n":12,"name":"Prakash Naik",      "inst":"c3","edu":"B.Com",                 "loc":"Tumakuru, Karnataka",     "g":"MALE",  "lit":"ADVANCED"},
    {"n":13,"name":"Shwetha Rao",       "inst":"c3","edu":"MBA Rural Management",  "loc":"Bengaluru, Karnataka",    "g":"FEMALE","lit":"ADVANCED"},
    {"n":14,"name":"Harjeet Singh",     "inst":"c4","edu":"B.A. Punjabi",          "loc":"Ludhiana, Punjab",        "g":"MALE",  "lit":"BASIC"},
    {"n":15,"name":"Simran Kaur",       "inst":"c4","edu":"B.Sc. Home Science",    "loc":"Patiala, Punjab",         "g":"FEMALE","lit":"INTERMEDIATE"},
    {"n":16,"name":"Gurpreet Dhillon",  "inst":"c4","edu":"Diploma Agri Marketing","loc":"Bathinda, Punjab",        "g":"MALE",  "lit":"INTERMEDIATE"},
    {"n":17,"name":"Sunita Bansal",     "inst":"c2","edu":"M.Com",                 "loc":"Pune, Maharashtra",       "g":"FEMALE","lit":"ADVANCED"}
  ]'::jsonb;
begin
  for v in select * from jsonb_array_elements(people) loop
    declare
      v_uid uuid := ('00000000-0000-0000-0000-00000000e0' || lpad((v.value->>'n')::text, 2, '0'))::uuid;
      v_email text := lower(replace(split_part(v.value->>'name', ' ', 1), '.', '')) || (v.value->>'n') || '@coopsetu.test';
      v_inst uuid := ('00000000-0000-0000-0000-0000000000' || (v.value->>'inst'))::uuid;
      v_member uuid;
      v_role uuid;
    begin
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
      values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, extensions.crypt('Password123!', extensions.gen_salt('bf')),
        now(), now() - interval '120 days', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v.value->>'name'), false, false)
      on conflict (id) do nothing;

      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_uid, v_uid::text,
              jsonb_build_object('sub', v_uid::text, 'email', v_email),
              'email', now(), now(), now())
      on conflict do nothing;

      update public.profiles
        set job_title = 'Trainee',
            username = split_part(v_email,'@',1) || '-coopsetu',
            username_normalized = lower(split_part(v_email,'@',1) || '-coopsetu'),
            profile_completed_at = now()
        where id = v_uid;

      update auth.users set
        confirmation_token='', recovery_token='', email_change_token_new='',
        email_change='', email_change_token_current='', phone_change='',
        phone_change_token='', reauthentication_token=''
      where id = v_uid;

      insert into public.organization_members (organization_id, user_id, employment_status, is_active, job_title, institution_id)
      values (v_org, v_uid, 'ACTIVE', true, 'Trainee', v_inst)
      on conflict (organization_id, user_id) do update set institution_id = excluded.institution_id
      returning id into v_member;
      if v_member is null then
        select id into v_member from public.organization_members where organization_id=v_org and user_id=v_uid;
      end if;

      select id into v_role from public.roles where code='TRAINEE' and organization_id is null;
      if v_role is not null then
        insert into public.member_roles (organization_member_id, role_id) values (v_member, v_role)
        on conflict do nothing;
      end if;

      insert into public.trainees (user_id, organization_id, institution_id, education, location, languages,
                                   digital_literacy_level, employment_status, gender, status, created_at)
      values (v_uid, v_org, v_inst, v.value->>'edu', v.value->>'loc',
              '{"Hindi","English"}', v.value->>'lit',
              case when (v.value->>'n')::int % 5 = 0 then 'EMPLOYED' else 'UNEMPLOYED' end,
              v.value->>'g', 'ACTIVE', now() - ((v.value->>'n')::int * 4 || ' days')::interval)
      on conflict (user_id, organization_id) do nothing;
    end;
  end loop;
end $$;

-- ------------------------------------------- programmes, batches, courses
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  v_vam uuid := '00000000-0000-0000-0000-0000000000c2';
  v_blr uuid := '00000000-0000-0000-0000-0000000000c3';
  v_chd uuid := '00000000-0000-0000-0000-0000000000c4';
  v_lko uuid := '00000000-0000-0000-0000-0000000000c5';
  v_bpl uuid := '00000000-0000-0000-0000-0000000000c6';
  t_vam uuid; t_icm uuid;
begin
  select id into t_vam from public.trainers where user_id='00000000-0000-0000-0000-0000000000b7';
  select id into t_icm from public.trainers where user_id='00000000-0000-0000-0000-0000000000b8';

  insert into public.programmes (id, organization_id, institution_id, title, description, duration_days, capacity, fee, status, start_date, end_date) values
   ('00000000-0000-0000-0000-00000000f101', v_org, v_vam, 'Rural Banking & Credit Management',
    'Credit appraisal, NPA management and the recovery process for primary agricultural credit societies.', 60, 45, 0, 'ACTIVE', current_date-40, current_date+20),
   ('00000000-0000-0000-0000-00000000f102', v_org, v_bpl, 'Dairy Cooperative Management',
    'Milk procurement, quality testing, chilling-centre operations and the Anand pattern of dairy cooperation.', 45, 35, 0, 'ACTIVE', current_date-30, current_date+15),
   ('00000000-0000-0000-0000-00000000f103', v_org, v_lko, 'PACS Computerisation',
    'Taking a primary agricultural credit society from paper ledgers to the national PACS software stack.', 30, 40, 0, 'ACTIVE', current_date-25, current_date+5),
   ('00000000-0000-0000-0000-00000000f104', v_org, v_blr, 'Cooperative Audit & Compliance',
    'Statutory audit, audit classification, and the objections that most often arise in cooperative accounts.', 50, 30, 0, 'ACTIVE', current_date-55, current_date-5),
   ('00000000-0000-0000-0000-00000000f105', v_org, v_chd, 'Agri Marketing & FPOs',
    'Forming and running a Farmer Producer Organisation: aggregation, grading, and market linkage.', 40, 40, 0, 'ACTIVE', current_date-20, current_date+20),
   ('00000000-0000-0000-0000-00000000f106', v_org, v_lko, 'Digital Literacy for Rural Youth',
    'Devices, the internet, digital payments, online forms and staying safe online.', 21, 60, 0, 'ACTIVE', current_date-15, current_date+6),
   ('00000000-0000-0000-0000-00000000f107', v_org, v_vam, 'Cooperative Leadership (Advanced)',
    'Board governance, strategy and financial oversight for senior cooperative office bearers.', 30, 25, 0, 'DRAFT', current_date+10, current_date+40)
  on conflict (id) do nothing;

  insert into public.batches (id, organization_id, programme_id, trainer_id, name, start_date, end_date, capacity, status, room) values
   ('00000000-0000-0000-0000-00000000f201', v_org, '00000000-0000-0000-0000-00000000f101', t_icm, 'RBC-2026-LKO-01', current_date-40, current_date+20, 45, 'ACTIVE',    'Hall B'),
   ('00000000-0000-0000-0000-00000000f202', v_org, '00000000-0000-0000-0000-00000000f101', t_vam, 'RBC-2026-PUN-01', current_date-38, current_date+22, 40, 'ACTIVE',    'Room 12'),
   ('00000000-0000-0000-0000-00000000f203', v_org, '00000000-0000-0000-0000-00000000f102', t_icm, 'DCM-2026-BPL-01', current_date-30, current_date+15, 35, 'ACTIVE',    'Dairy Lab'),
   ('00000000-0000-0000-0000-00000000f204', v_org, '00000000-0000-0000-0000-00000000f103', t_icm, 'PACS-2026-LKO-01',current_date-25, current_date+5,  40, 'ACTIVE',    'Computer Lab 1'),
   ('00000000-0000-0000-0000-00000000f205', v_org, '00000000-0000-0000-0000-00000000f103', t_icm, 'PACS-2026-LKO-02',current_date-10, current_date+20, 40, 'ACTIVE',    'Computer Lab 2'),
   ('00000000-0000-0000-0000-00000000f206', v_org, '00000000-0000-0000-0000-00000000f104', t_vam, 'AUD-2026-BLR-01', current_date-55, current_date-5,  30, 'COMPLETED', 'Seminar Hall'),
   ('00000000-0000-0000-0000-00000000f207', v_org, '00000000-0000-0000-0000-00000000f105', t_vam, 'FPO-2026-CHD-01', current_date-20, current_date+20, 40, 'ACTIVE',    'Hall A'),
   ('00000000-0000-0000-0000-00000000f208', v_org, '00000000-0000-0000-0000-00000000f106', t_icm, 'DL-2026-LKO-01',  current_date-15, current_date+6,  60, 'ACTIVE',    'Computer Lab 1'),
   ('00000000-0000-0000-0000-00000000f209', v_org, '00000000-0000-0000-0000-00000000f106', t_icm, 'DL-2026-BPL-01',  current_date-12, current_date+9,  60, 'ACTIVE',    'IT Room'),
   ('00000000-0000-0000-0000-00000000f20a', v_org, '00000000-0000-0000-0000-00000000f107', t_vam, 'LEAD-2026-PUN-01',current_date+10, current_date+40, 25, 'UPCOMING',  'Board Room'),
   ('00000000-0000-0000-0000-00000000f20b', v_org, '00000000-0000-0000-0000-00000000f102', t_vam, 'DCM-2026-PUN-01', current_date-60, current_date-10, 35, 'COMPLETED', 'Dairy Lab')
  on conflict (id) do nothing;

  insert into public.courses (id, programme_id, trainer_id, title, description, duration_hours, order_index, status) values
   ('00000000-0000-0000-0000-00000000f301','00000000-0000-0000-0000-00000000f101', t_icm, 'Credit Appraisal Fundamentals',   'How a society decides whether a loan is sound, and what it must record when it does.', 14, 1, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f302','00000000-0000-0000-0000-00000000f101', t_icm, 'NPA Management and Recovery',     'Recognising a non-performing asset early, and the recovery routes open to a society.', 10, 2, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f303','00000000-0000-0000-0000-00000000f102', t_icm, 'Milk Procurement and Quality',    'Collection routes, fat and SNF testing, chilling, and paying a farmer correctly.',      12, 1, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f304','00000000-0000-0000-0000-00000000f103', t_icm, 'PACS Software Essentials',        'Day-to-day operation of the national PACS package: members, deposits, loans, reports.', 16, 1, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f305','00000000-0000-0000-0000-00000000f103', t_icm, 'Migrating Ledgers to Digital',    'Preparing, cleaning and importing a society''s existing books without losing history.',  8, 2, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f306','00000000-0000-0000-0000-00000000f104', t_vam, 'Cooperative Audit Practice',      'The statutory audit cycle, audit classification, and drafting an audit memorandum.',    18, 1, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f307','00000000-0000-0000-0000-00000000f105', t_vam, 'Building a Farmer Producer Organisation', 'Mobilising members, registering an FPO, and its first season of business.',      12, 1, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f308','00000000-0000-0000-0000-00000000f106', t_icm, 'Digital Basics',                  'Using a smartphone and a computer with confidence: files, browsing, forms, safety.',     10, 1, 'ACTIVE'),
   ('00000000-0000-0000-0000-00000000f309','00000000-0000-0000-0000-00000000f106', t_icm, 'Digital Payments and UPI',        'Making and receiving payments safely, and recognising the common frauds.',               6, 2, 'ACTIVE')
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------------ modules
-- Five modules per course across the nine courses. The mix is deliberate: a
-- presentation and a video open each course, reading and practice follow, and a
-- quiz closes it — so the content-engagement panel has more than one type to
-- compare and the drop-off column means something.
do $$
declare
  c record;
  i int;
  v_type text; v_title text; v_url text; v_text text; v_mins int;
begin
  for c in select id, title from public.courses
            where id::text like '00000000-0000-0000-0000-00000000f3%' order by id loop
    for i in 1..5 loop
      v_type := case i when 1 then 'PPT' when 2 then 'VIDEO' when 3 then 'TEXT' when 4 then 'PDF' else 'QUIZ' end;
      v_mins := case i when 1 then 20 when 2 then 14 when 3 then 25 when 4 then 18 else 15 end;
      v_title := case i
        when 1 then 'Overview — ' || c.title
        when 2 then 'Walkthrough — ' || c.title
        when 3 then 'Reading — ' || c.title
        when 4 then 'Reference handbook — ' || c.title
        else 'Knowledge check — ' || c.title end;
      v_url := case i
        when 1 then 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        when 2 then 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
        when 4 then 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
        else null end;
      v_text := case when i in (3,5) then
        'This session covers the practical side of ' || c.title || E'.\n\n'
        'Work through it at your own pace. The points below are the ones that come up most often in the field, and the ones an auditor is most likely to ask about.\n\n'
        '1. Record the decision, not just the outcome. A society that cannot show why it acted has a finding waiting for it, however sound the action was.\n\n'
        '2. The by-laws set the limits. Where a limit is silent, the managing committee decides — and that decision belongs in the minutes.\n\n'
        '3. Members are entitled to the books. Openness is not a courtesy in a cooperative; it is the mechanism by which democratic control actually works.\n\n'
        'Take the knowledge check at the end of this course once you have worked through every module.'
        else null end;

      insert into public.course_modules (course_id, title, type, content_url, content_text, duration_minutes, order_index, is_mandatory)
      select c.id, v_title, v_type, v_url, v_text, v_mins, i, (i <> 4)
      where not exists (
        select 1 from public.course_modules m where m.course_id = c.id and m.order_index = i
      );
    end loop;
  end loop;
end $$;

-- -------------------------------------------------------------- assessments
do $$
declare
  c record; a_id uuid; q int;
begin
  for c in select id, title from public.courses
            where id::text like '00000000-0000-0000-0000-00000000f3%' order by id limit 8 loop
    a_id := ('00000000-0000-0000-0000-00000000f4' || lpad((row_number() over ())::text, 2, '0'))::uuid;
    insert into public.assessments (course_id, title, description, type, max_score, passing_score, duration_minutes, attempts_allowed, is_published)
    select c.id, c.title || ' — Final Assessment',
           'Six questions covering the whole course. You need 60% to pass.',
           'QUIZ', 60, 36, 45, 2, true
    where not exists (select 1 from public.assessments x where x.course_id = c.id);
  end loop;
end $$;

-- Questions: six per assessment, real cooperative-domain content.
do $$
declare a record; i int;
declare qs jsonb := '[
  {"q":"Under the one-member-one-vote principle, how many votes does a member holding 50 shares have at the general body?",
   "o":["One","Fifty","Proportional to shareholding","Depends on the by-laws"],"a":"One"},
  {"q":"Who is collectively responsible for sanctioning a loan above the secretary''s limit?",
   "o":["The secretary","The managing committee","The Registrar","The auditor"],"a":"The managing committee"},
  {"q":"Surplus in a cooperative is distributed in proportion to:",
   "o":["Shareholding","Use of the society''s services","Seniority of membership","Equally to all members"],"a":"Use of the society''s services"},
  {"q":"Which of these can the Registrar NOT do?",
   "o":["Order an audit","Register a society","Run the society''s daily business","Order an inquiry"],"a":"Run the society''s daily business"},
  {"q":"The most frequent finding in cooperative audit is:",
   "o":["Cash shortage","Missing committee resolution","Unregistered members","Late annual return"],"a":"Missing committee resolution"},
  {"q":"Membership of a cooperative may be refused on the grounds of:",
   "o":["Religion","Gender","Political affiliation","None of these"],"a":"None of these"}
]'::jsonb;
begin
  for a in select id from public.assessments where id is not null loop
    if exists (select 1 from public.assessment_questions where assessment_id = a.id) then continue; end if;
    i := 0;
    for i in 0..5 loop
      insert into public.assessment_questions (assessment_id, question_text, question_type, options, correct_answer, marks, order_index)
      values (a.id, qs->i->>'q', 'MCQ', qs->i->'o', qs->i->>'a', 10, i+1);
    end loop;
  end loop;
end $$;

-- -------------------------------------------------------------- enrolments
-- Each trainee joins two to four programmes, their own institute's first, so
-- the enrolment matches where they actually study. The spread matters: with
-- everyone on the same two programmes the timeline has no texture and the
-- content-engagement table ranks nothing.
do $$
declare t record; p record; n int := 0; want int;
begin
  for t in select tr.id, tr.institution_id from public.trainees tr
            where tr.organization_id='00000000-0000-0000-0000-0000000000a0' and tr.status='ACTIVE' loop
    n := 0;
    want := 2 + (abs(hashtext(t.id::text || 'enr')) % 3);
    for p in select pr.id, pr.institution_id from public.programmes pr
              where pr.organization_id='00000000-0000-0000-0000-0000000000a0'
                and pr.status='ACTIVE'
              order by (pr.institution_id = t.institution_id) desc, pr.id loop
      exit when n >= want;
      insert into public.enrollments (trainee_id, programme_id, batch_id, status, source, enrolled_at, created_at)
      select t.id, p.id,
             (select b.id from public.batches b where b.programme_id = p.id and b.status='ACTIVE' limit 1),
             -- The oldest enrolment of a long-standing trainee is finished;
             -- without any COMPLETED row the programme-graduate achievement
             -- and the completion funnel both stay empty.
             case when n = 0 and (abs(hashtext(t.id::text)) % 3) = 0 then 'COMPLETED' else 'ENROLLED' end,
             case when n = 0 then 'NOMINATED' else 'SELF' end,
             now() - ((30 + n*10) || ' days')::interval,
             now() - ((35 + n*10) || ' days')::interval
      on conflict (trainee_id, programme_id) do nothing;
      n := n + 1;
    end loop;
  end loop;
end $$;

-- ==========================================================================
-- 90 days of learning history
--
-- Generated rather than enumerated. setseed() fixes the sequence so the same
-- `db reset` always produces the same demo — a chart that reshuffles between
-- runs is impossible to talk about.
--
-- The shape is deliberate, not uniform noise:
--   * each trainee gets a "pace" from their id, so some race ahead and some
--     barely start — which is what makes the drop-out panel meaningful;
--   * weekends are quieter than weekdays;
--   * a few trainees stop entirely part-way through, so the timeline has the
--     falling-off that a real cohort shows.
--
-- course_progress is derived FROM these events afterwards, never written
-- independently, so the current state and the history cannot disagree.
-- ==========================================================================
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-0000000000a0';
  t record; m record;
  day_offset int; gives_up int;
  pct int; secs int; ts timestamptz;
  module_index int; visits int; v int; v_pct int; v_secs int;
begin
  perform setseed(0.42);

  for t in
    select tr.id, tr.created_at,
           -- Pace and persistence derived from the id, so they are stable
           -- across resets and vary believably between people.
           (abs(hashtext(tr.id::text)) % 5 + 1)::numeric as speed,
           (abs(hashtext(tr.id::text || 'x')) % 100)     as persistence
      from public.trainees tr
     where tr.organization_id = v_org and tr.status = 'ACTIVE'
  loop
    -- ~15% of the cohort disengages part-way; the rest keep going.
    gives_up := case when t.persistence < 15 then 25 + (t.persistence % 20) else 200 end;
    module_index := 0;

    for m in
      select cm.id as module_id, cm.course_id, cm.duration_minutes
        from public.course_modules cm
        join public.courses c on c.id = cm.course_id
        join public.enrollments e on e.programme_id = c.programme_id
       where e.trainee_id = t.id
       order by c.id, cm.order_index
    loop
      module_index := module_index + 1;
      -- Faster learners cover more ground per calendar day.
      day_offset := 84 - floor(module_index * (4.0 / t.speed))::int;
      exit when day_offset < 1;
      exit when module_index > gives_up;

      ts := date_trunc('day', now()) - (day_offset || ' days')::interval
            + ((9 + (abs(hashtext(m.module_id::text)) % 10)) || ' hours')::interval;

      -- Weekends: most people skip, so only ~30% of weekend slots produce a session.
      if extract(dow from ts) in (0, 6) and random() > 0.3 then
        continue;
      end if;

      -- How far they actually got. Most finish; some stall part-way, which is
      -- what gives the content-engagement drop-off column something to show.
      pct := case
        when random() < 0.72 then 100
        when random() < 0.6  then 40 + (random() * 45)::int
        else 10 + (random() * 25)::int
      end;
      secs := greatest(60, (coalesce(m.duration_minutes, 15) * 60 * (pct / 100.0) * (0.7 + random() * 0.6))::int);

      -- A module is rarely finished in one sitting. Splitting it across one to
      -- three sessions is both truer to how people study and what gives the
      -- daily timeline and the streak counter something to count.
      visits := 1 + (abs(hashtext(t.id::text || m.module_id::text)) % 3);
      for v in 1..visits loop
        -- Earlier sittings land on earlier days and reach less far; the last
        -- one carries the final figure, and course_progress takes the maximum.
        ts := date_trunc('day', now()) - ((day_offset + (visits - v) * 2) || ' days')::interval
              + ((8 + (abs(hashtext(m.module_id::text || v::text)) % 11)) || ' hours')::interval
              + ((abs(hashtext(v::text || m.module_id::text)) % 60) || ' minutes')::interval;

        v_pct  := (pct * v) / visits;
        v_secs := greatest(60, secs / visits);

        insert into public.lms_events (organization_id, trainee_id, course_id, module_id, event_type, progress_pct, seconds_spent, occurred_at)
        values (v_org, t.id, m.course_id, m.module_id, 'VIEW_START', 0, 0, ts);

        insert into public.lms_events (organization_id, trainee_id, course_id, module_id, event_type, progress_pct, seconds_spent, occurred_at)
        values (v_org, t.id, m.course_id, m.module_id,
                case when v = visits and pct >= 100 then 'MODULE_COMPLETE' else 'VIEW_PROGRESS' end,
                v_pct, v_secs, ts + (v_secs || ' seconds')::interval);
      end loop;

    end loop;
  end loop;
end $$;

-- --------------------------------------------- derive course_progress from it
-- One pass over the log: the furthest point reached per module wins, which is
-- exactly the high-water rule the live player applies.
insert into public.course_progress (trainee_id, course_id, module_id, progress_pct, completed, completed_at, last_accessed_at, time_spent_seconds)
select e.trainee_id, e.course_id, e.module_id,
       max(e.progress_pct)                                        as progress_pct,
       max(e.progress_pct) >= 100                                 as completed,
       case when max(e.progress_pct) >= 100 then max(e.occurred_at) end as completed_at,
       max(e.occurred_at)                                         as last_accessed_at,
       sum(e.seconds_spent)                                       as time_spent_seconds
  from public.lms_events e
 where e.module_id is not null
 group by e.trainee_id, e.course_id, e.module_id
on conflict (trainee_id, course_id, module_id) do nothing;

-- ------------------------------------------------------- assessment results
-- Only trainees who actually finished most of a course sit its assessment —
-- results that appear without the learning behind them would undercut the
-- funnel they are meant to illustrate.
do $$
declare r record; sc int; att int;
begin
  perform setseed(0.73);
  for r in
    select a.id as assessment_id, a.course_id, a.max_score, cp.trainee_id,
           count(*) filter (where cp.completed) as done,
           count(*) as total
      from public.assessments a
      join public.course_progress cp on cp.course_id = a.course_id
     group by a.id, a.course_id, a.max_score, cp.trainee_id
    having count(*) filter (where cp.completed) >= 3
  loop
    -- A believable spread: mostly passes, a tail of failures, a few perfect.
    sc := case
      when random() < 0.12 then r.max_score
      when random() < 0.70 then (r.max_score * (0.62 + random() * 0.32))::int
      when random() < 0.80 then (r.max_score * (0.40 + random() * 0.18))::int
      else (r.max_score * (0.15 + random() * 0.24))::int
    end;
    att := case when sc < r.max_score * 0.6 and random() < 0.5 then 2 else 1 end;

    insert into public.assessment_results (assessment_id, trainee_id, score, max_score, passed, attempt_number, submitted_at, graded_at)
    values (r.assessment_id, r.trainee_id, sc, r.max_score,
            sc >= r.max_score * 0.6, att,
            now() - ((3 + (abs(hashtext(r.trainee_id::text || r.assessment_id::text)) % 30)) || ' days')::interval,
            now() - ((2 + (abs(hashtext(r.trainee_id::text)) % 25)) || ' days')::interval);

    insert into public.lms_events (organization_id, trainee_id, course_id, assessment_id, event_type, progress_pct, seconds_spent, occurred_at)
    values ('00000000-0000-0000-0000-0000000000a0', r.trainee_id, r.course_id, r.assessment_id,
            'ASSESSMENT_SUBMIT', 100, 1200,
            now() - ((3 + (abs(hashtext(r.trainee_id::text || r.assessment_id::text)) % 30)) || ' days')::interval);
  end loop;
end $$;

-- ------------------------------------------------------------ skill passport
-- Skills follow completed learning rather than being sprinkled on: a passport
-- that shows skills nobody earned is the fabricated-dashboard problem the
-- project's own docs warn against.
do $$
declare r record;
begin
  perform setseed(0.19);
  for r in
    select cp.trainee_id, count(*) filter (where cp.completed) as done
      from public.course_progress cp group by cp.trainee_id
  loop
    insert into public.trainee_skills (trainee_id, skill_id, proficiency, verified, source, verified_at)
    select r.trainee_id, s.id,
           least(100, 45 + (r.done * 3) + (abs(hashtext(r.trainee_id::text || s.id::text)) % 20)),
           r.done >= 5,
           case when r.done >= 5 then 'COURSE' else 'SELF_DECLARED' end,
           case when r.done >= 5 then now() - '10 days'::interval end
      from public.skills s
     where s.name in ('Cooperative Law','Cooperative Audit','Rural Development','Financial Management',
                      'Digital Literacy','Communication','Accounting','Leadership')
       and r.done > 0
    on conflict (trainee_id, skill_id) do nothing;
  end loop;
end $$;

-- --------------------------------------------------------- employment exchange
-- jobs hangs off employers, which are already organization-scoped, so a job
-- carries no organization_id of its own.
do $$
declare
  e_iffco uuid; e_amul uuid; v_job uuid; v_tr uuid; n int;
begin
  select id into e_iffco from public.employers where user_id='00000000-0000-0000-0000-0000000000bc';
  select id into e_amul  from public.employers where user_id='00000000-0000-0000-0000-0000000000bd';

  insert into public.jobs (id, employer_id, title, description, location, employment_type, salary_min, salary_max, vacancies, experience_min, education_required, deadline, status)
  values
   ('00000000-0000-0000-0000-00000000f501', e_iffco, 'Cooperative Field Officer',      'Field liaison with PACS across the district: membership drives, credit follow-up and monthly reporting.', 'Lucknow, Uttar Pradesh', 'FULL_TIME', 280000, 360000, 6, 0, 'Graduate', current_date+30, 'OPEN'),
   ('00000000-0000-0000-0000-00000000f502', e_iffco, 'Credit Analyst — Rural Lending', 'Appraise crop and allied-activity loan applications received from primary societies.',                    'Bhopal, Madhya Pradesh', 'FULL_TIME', 340000, 450000, 3, 1, 'Graduate (Commerce preferred)', current_date+21, 'OPEN'),
   ('00000000-0000-0000-0000-00000000f503', e_iffco, 'PACS Computerisation Trainer',   'Train society staff on the national PACS package and support them through go-live.',                       'Bengaluru, Karnataka',   'CONTRACT',  300000, 400000, 4, 1, 'Graduate', current_date+45, 'OPEN'),
   ('00000000-0000-0000-0000-00000000f504', e_amul,  'Dairy Procurement Assistant',    'Run a village collection route: quality testing, weighing and farmer payment records.',                    'Anand, Gujarat',         'FULL_TIME', 240000, 300000, 8, 0, '12th pass', current_date+25, 'OPEN'),
   ('00000000-0000-0000-0000-00000000f505', e_amul,  'Quality Control Technician',     'Fat and SNF testing at a chilling centre, and keeping the cold-chain records.',                            'Bhopal, Madhya Pradesh', 'FULL_TIME', 260000, 330000, 5, 0, 'Diploma / Graduate', current_date+18, 'OPEN'),
   ('00000000-0000-0000-0000-00000000f506', e_amul,  'FPO Business Coordinator',       'Support a Farmer Producer Organisation through aggregation, grading and market linkage.',                  'Ludhiana, Punjab',       'FULL_TIME', 300000, 380000, 2, 2, 'Graduate', current_date+40, 'OPEN')
  on conflict (id) do nothing;

  -- Required skills, so the match score on an application has something to be
  -- a score of rather than being a decorative number.
  insert into public.job_skills (job_id, skill_id, importance)
  select j.id, s.id, v.importance
    from (values
      ('00000000-0000-0000-0000-00000000f501','Cooperative Law','REQUIRED'),
      ('00000000-0000-0000-0000-00000000f501','Communication','REQUIRED'),
      ('00000000-0000-0000-0000-00000000f501','Rural Development','PREFERRED'),
      ('00000000-0000-0000-0000-00000000f502','Accounting','REQUIRED'),
      ('00000000-0000-0000-0000-00000000f502','Financial Management','REQUIRED'),
      ('00000000-0000-0000-0000-00000000f502','Cooperative Audit','PREFERRED'),
      ('00000000-0000-0000-0000-00000000f503','Digital Literacy','REQUIRED'),
      ('00000000-0000-0000-0000-00000000f503','Communication','REQUIRED'),
      ('00000000-0000-0000-0000-00000000f504','Financial Management','PREFERRED'),
      ('00000000-0000-0000-0000-00000000f504','Digital Literacy','NICE_TO_HAVE'),
      ('00000000-0000-0000-0000-00000000f505','Digital Literacy','PREFERRED'),
      ('00000000-0000-0000-0000-00000000f506','Rural Development','REQUIRED'),
      ('00000000-0000-0000-0000-00000000f506','Leadership','PREFERRED'),
      ('00000000-0000-0000-0000-00000000f506','Accounting','NICE_TO_HAVE')
    ) as v(job_id, skill_name, importance)
    join public.jobs j on j.id = v.job_id::uuid
    join public.skills s on s.name = v.skill_name
  on conflict (job_id, skill_id) do nothing;

  -- Applications from trainees who have finished enough for one to be plausible.
  perform setseed(0.57);
  for v_job in select id from public.jobs where employer_id in (e_iffco, e_amul) loop
    n := 0;
    for v_tr in
      select cp.trainee_id from public.course_progress cp
       group by cp.trainee_id having count(*) filter (where cp.completed) >= 4
       order by cp.trainee_id
    loop
      exit when n >= 5;
      insert into public.job_applications (job_id, trainee_id, status, match_score, applied_at)
      values (v_job, v_tr,
              (array['APPLIED','SHORTLISTED','INTERVIEWED','APPLIED','OFFERED'])[1 + (abs(hashtext(v_tr::text || v_job::text)) % 5)],
              45 + (abs(hashtext(v_job::text || v_tr::text)) % 50),
              now() - ((2 + (abs(hashtext(v_tr::text)) % 20)) || ' days')::interval)
      on conflict (job_id, trainee_id) do nothing;
      n := n + 1;
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------------ attendance
-- Sessions twice a week per active batch for the last six weeks, so the
-- attendance trend is a line rather than a single point.
do $$
declare b record; d date; s_id uuid; e record;
begin
  perform setseed(0.31);
  for b in select id, trainer_id from public.batches
            where organization_id='00000000-0000-0000-0000-0000000000a0' and status='ACTIVE' loop
    d := current_date - 42;
    while d < current_date loop
      if extract(dow from d) in (2, 4) then
        insert into public.attendance_sessions (batch_id, trainer_id, date, session_type, session_slot, is_active, qr_token, qr_expires_at)
        values (b.id, b.trainer_id, d, 'LECTURE', 'MORNING', false, gen_random_uuid()::text, d + interval '1 day')
        returning id into s_id;

        for e in select trainee_id from public.enrollments where batch_id = b.id and status='ENROLLED' loop
          insert into public.attendance_records (session_id, trainee_id, status, method, marked_at)
          values (s_id, e.trainee_id,
                  -- ~82% present, with lateness and absence in believable proportion.
                  case when random() < 0.82 then 'PRESENT'
                       when random() < 0.6  then 'LATE'
                       else 'ABSENT' end,
                  case when random() < 0.7 then 'QR' else 'MANUAL' end,
                  d + interval '9 hours');
        end loop;
      end if;
      d := d + 1;
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------ achievements
-- Awarded from the data just seeded, using the same thresholds the service
-- evaluates at runtime, so a trainee's shelf matches what they actually did.
do $$
declare t record; a record; val int; streak int;
begin
  for t in select id from public.trainees where organization_id='00000000-0000-0000-0000-0000000000a0' loop
    select count(*) filter (where completed) into val from public.course_progress where trainee_id = t.id;
    select count(distinct occurred_at::date) into streak from public.lms_events where trainee_id = t.id;

    for a in select * from public.achievements loop
      val := case a.criteria->>'metric'
        when 'modules_completed'  then (select count(*) from public.course_progress where trainee_id=t.id and completed)
        when 'courses_completed'  then (select count(*) from (
                                          select cp.course_id from public.course_progress cp
                                           where cp.trainee_id=t.id group by cp.course_id
                                          having count(*) filter (where cp.completed) >= (
                                            select count(*) from public.course_modules m where m.course_id = cp.course_id)) z)
        when 'assessments_passed' then (select count(*) from public.assessment_results where trainee_id=t.id and passed)
        when 'perfect_scores'     then (select count(*) from public.assessment_results where trainee_id=t.id and score >= max_score)
        when 'certificates'       then (select count(*) from public.certificates where trainee_id=t.id and status='ACTIVE')
        when 'skills_verified'    then (select count(*) from public.trainee_skills where trainee_id=t.id and verified)
        when 'streak_days'        then streak
        when 'programmes_completed' then (select count(*) from public.enrollments where trainee_id=t.id and status='COMPLETED')
        else 0 end;

      if val >= (a.criteria->>'threshold')::int then
        insert into public.trainee_achievements (trainee_id, achievement_id, unlocked_at, unlocked_value)
        values (t.id, a.id,
                now() - ((abs(hashtext(t.id::text || a.code)) % 40) || ' days')::interval, val)
        on conflict (trainee_id, achievement_id) do nothing;
      end if;
    end loop;
  end loop;
end $$;
