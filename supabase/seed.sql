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
