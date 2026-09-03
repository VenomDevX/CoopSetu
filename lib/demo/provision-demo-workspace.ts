import { createAdminClient } from '@/lib/supabase/admin';

export const DEMO_PERSONAS = [
  { role: 'SUPER_ADMIN', email: 'demo-super@coopsetu.local', name: 'NCCT Authority', title: 'Super Admin' },
  { role: 'INSTITUTE_ADMIN', email: 'demo-admin@coopsetu.local', name: 'Institute Director', title: 'Institute Admin' },
  { role: 'TRAINER', email: 'demo-trainer@coopsetu.local', name: 'Expert Trainer', title: 'Trainer' },
  { role: 'TRAINEE', email: 'demo-trainee@coopsetu.local', name: 'Student Trainee', title: 'Trainee' },
  { role: 'EMPLOYER', email: 'demo-employer@coopsetu.local', name: 'HR Director', title: 'Employer' },
];

// Resolve an auth user by email across all pages of the admin user list.
// `listUsers()` only returns the first page, which is unreliable once the
// database holds more than one page of users.
async function findAuthUserByEmail(admin: any, email: string) {
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const match = data.users.find((u: any) => u.email === email);
    if (match) return match;
    if (data.users.length < perPage) return undefined; // last page reached
  }
}

export async function provisionDemoWorkspace(authUserId: string, requestedRole: string) {
  const admin = createAdminClient();

  // 1. Create Organization
  const orgName = `Demo Workspace`;
  const orgSlug = `demo-${authUserId.substring(0, 8)}-${Date.now()}`;

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: orgName,
      slug: orgSlug,
      is_demo: true,
      created_by: authUserId,
    })
    .select()
    .single();

  if (orgError || !org) throw new Error(`Failed to create demo org: ${orgError?.message}`);

  // 2. Get System Roles
  const { data: systemRoles, error: rolesError } = await admin
    .from('roles')
    .select('*')
    .is('organization_id', null);

  if (rolesError || !systemRoles) throw new Error(`Failed to fetch system roles: ${rolesError?.message}`);
  const roleMap = new Map(systemRoles.map((r: any) => [r.code, r.id]));

  // 3. Ensure Shared Dummy Users exist
  const dummyUserIds: Record<string, string> = {};
  for (const persona of DEMO_PERSONAS) {
    if (persona.role === requestedRole) continue; // The visitor takes this persona

    // Check if user exists. `listUsers()` is paginated (50/page by default), so
    // in a busy database (e.g. CI running many suites in parallel) the shared
    // demo persona can fall off page 1 — scan every page before deciding it's
    // missing, otherwise we'd try to re-create an existing email.
    let user = await findAuthUserByEmail(admin, persona.email);

    if (!user) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: persona.email,
        // Dummy demo personas are never logged into directly — only the
        // anonymous visitor logs in. Give them a random, discarded password so
        // they can't be signed into with a guessable/shared credential.
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        email_confirm: true,
        user_metadata: { full_name: persona.name },
      });
      if (createError) {
        // A concurrent provision may have created the persona between our scan
        // and this insert; fall back to re-reading it rather than failing.
        user = await findAuthUserByEmail(admin, persona.email);
        if (!user) throw new Error(`Failed to create dummy user: ${createError.message}`);
      } else {
        user = newUser.user;
      }
    }
    dummyUserIds[persona.role] = user.id;
  }

  let visitorMemberId = '';

  // 4. Create Members
  for (const persona of DEMO_PERSONAS) {
    const isVisitor = persona.role === requestedRole;
    const userId = isVisitor ? authUserId : dummyUserIds[persona.role];

    const { data: member, error: memberError } = await admin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userId,
        employment_status: 'ACTIVE',
        is_active: true,
        job_title: persona.title,
      })
      .select()
      .single();

    if (memberError || !member) throw new Error(`Failed to create member: ${memberError?.message}`);

    if (isVisitor) {
      visitorMemberId = member.id;
    }

    // Assign role
    const roleId = roleMap.get(persona.role);
    if (roleId) {
      await admin
        .from('member_roles')
        .insert({
          organization_member_id: member.id,
          role_id: roleId,
        });
    }
  }

  // 5. Create Demo Session Record
  const { error: sessionError } = await admin
    .from('demo_sessions')
    .insert({
      auth_user_id: authUserId,
      organization_id: org.id,
      demo_member_id: visitorMemberId,
      active_demo_role: requestedRole,
      seed_version: 'v1',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: new Date().toISOString(),
    });

  if (sessionError) throw new Error(`Failed to create demo session: ${sessionError.message}`);

  // 6. Seed fictional data (Projects, Sprints, Tasks, etc.)
  await seedDemoData(admin, org.id, dummyUserIds, authUserId, requestedRole, visitorMemberId);

  return { orgId: org.id, memberId: visitorMemberId };
}

async function seedDemoData(admin: any, orgId: string, dummyUserIds: Record<string, string>, visitorUserId: string, visitorRole: string, visitorMemberId: string) {
  // Helpers to resolve UUIDs
  const getUserId = (role: string) => role === visitorRole ? visitorUserId : dummyUserIds[role];
  const getMemberId = (role: string) => role === visitorRole ? visitorMemberId : dummyUserIds[role]; // Wait, we need real member IDs

  const { data: orgMembers } = await admin.from('organization_members').select('id, user_id').eq('organization_id', orgId);
  
  const resolveMember = (role: string) => {
    const uid = getUserId(role);
    return orgMembers.find((m: any) => m.user_id === uid)?.id;
  };

  const superAdmin = resolveMember('SUPER_ADMIN');
  const instituteAdmin = resolveMember('INSTITUTE_ADMIN');
  const trainerMember = resolveMember('TRAINER');
  const traineeMember = resolveMember('TRAINEE');
  const employerMember = resolveMember('EMPLOYER');

  const trainerUserId = getUserId('TRAINER');
  const traineeUserId = getUserId('TRAINEE');
  const employerUserId = getUserId('EMPLOYER');

  // ==========================================================================
  // 1. TRAINING ERP FOUNDATION
  // ==========================================================================
  
  // Institution
  const { data: inst } = await admin.from('institutions').insert({
    organization_id: orgId,
    name: 'VAMNICOM - National Institute of Cooperative Management',
    code: 'VAMNICOM-01',
    type: 'TRAINING_INSTITUTE',
    contact_email: 'admin@vamnicom.edu.in',
    status: 'ACTIVE'
  }).select().single();

  // Programme
  const { data: prog } = await admin.from('programmes').insert({
    organization_id: orgId,
    institution_id: inst.id,
    title: 'Diploma in Cooperative Banking & Management',
    description: 'Comprehensive 12-week program covering banking ops, compliance, and cooperative principles.',
    duration_days: 84,
    status: 'ACTIVE'
  }).select().single();

  // Trainer Persona
  const { data: trainer } = await admin.from('trainers').insert({
    user_id: trainerUserId,
    organization_id: orgId,
    institution_id: inst.id,
    specialization: 'Banking Operations & Risk Management',
    experience_years: 12,
    status: 'ACTIVE'
  }).select().single();

  // Trainee Persona
  const { data: trainee } = await admin.from('trainees').insert({
    user_id: traineeUserId,
    organization_id: orgId,
    education: 'B.Com Graduate',
    digital_literacy_level: 'INTERMEDIATE',
    employment_status: 'UNEMPLOYED',
    status: 'ACTIVE'
  }).select().single();

  // Employer Persona
  const { data: employerOrg } = await admin.from('employers').insert({
    organization_id: orgId,
    company_name: 'Apex Cooperative Bank Ltd.',
    industry: 'Banking',
    contact_person_id: employerUserId,
    status: 'VERIFIED'
  }).select().single();

  // ==========================================================================
  // 2. BATCHES & ENROLLMENTS
  // ==========================================================================

  const { data: batch } = await admin.from('batches').insert({
    organization_id: orgId,
    programme_id: prog.id,
    name: 'Batch Alpha - Fall 2026',
    trainer_id: trainer.id,
    start_date: new Date().toISOString(),
    status: 'ACTIVE'
  }).select().single();

  await admin.from('enrollments').insert({
    trainee_id: trainee.id,
    programme_id: prog.id,
    batch_id: batch.id,
    status: 'ENROLLED',
    enrolled_at: new Date().toISOString()
  });

  // ==========================================================================
  // 3. LEARNING LMS
  // ==========================================================================

  const { data: course1 } = await admin.from('courses').insert({
    programme_id: prog.id,
    trainer_id: trainer.id,
    title: 'Core Banking Fundamentals',
    duration_hours: 40,
    status: 'ACTIVE'
  }).select().single();

  await admin.from('course_modules').insert([
    { course_id: course1.id, title: 'Intro to Cooperative Banking', type: 'VIDEO', duration_minutes: 45, order_index: 1 },
    { course_id: course1.id, title: 'Regulatory Compliance (KYC)', type: 'PDF', duration_minutes: 30, order_index: 2 }
  ]);

  const { data: assessment } = await admin.from('assessments').insert({
    course_id: course1.id,
    title: 'Midterm Knowledge Check',
    type: 'QUIZ',
    max_score: 100,
    passing_score: 60,
    status: 'PUBLISHED'
  }).select().single();

  await admin.from('assessment_submissions').insert({
    assessment_id: assessment.id,
    trainee_id: trainee.id,
    score: 85,
    status: 'GRADED'
  });

  await admin.from('skill_passports').insert([
    { trainee_id: trainee.id, organization_id: orgId, skill_name: 'KYC Verification', proficiency_level: 'INTERMEDIATE', validation_source: 'ASSESSMENT' },
    { trainee_id: trainee.id, organization_id: orgId, skill_name: 'Core Banking Systems', proficiency_level: 'BASIC', validation_source: 'SELF' }
  ]);

  // ==========================================================================
  // 4. EMPLOYMENT EXCHANGE
  // ==========================================================================

  const { data: job } = await admin.from('jobs').insert({
    organization_id: orgId,
    employer_id: employerOrg.id,
    title: 'Junior Cooperative Officer',
    type: 'FULL_TIME',
    location: 'Mumbai, MH',
    salary_range: '₹3,00,000 - ₹4,50,000',
    status: 'PUBLISHED'
  }).select().single();

  await admin.from('job_applications').insert({
    job_id: job.id,
    trainee_id: trainee.id,
    status: 'SHORTLISTED'
  });

  // ==========================================================================
  // 5. EXISTING OPS_MGT & ENG_CORE
  // ==========================================================================
  const { data: project } = await admin.from('projects').insert({
    organization_id: orgId,
    name: 'Banking Platform Upgrade',
    code: 'BPU',
    priority: 'HIGH',
    health: 'ON_TRACK',
    owner_member_id: superAdmin,
    project_manager_member_id: instituteAdmin,
    status: 'ACTIVE'
  }).select().single();

  await admin.from('project_members').insert([
    { project_id: project.id, organization_member_id: instituteAdmin, project_role: 'Director', can_manage: true, can_view: true, can_edit: true, can_comment: true },
    { project_id: project.id, organization_member_id: trainerMember, project_role: 'Trainer', can_manage: false, can_view: true, can_edit: true, can_comment: true },
    { project_id: project.id, organization_member_id: traineeMember, project_role: 'Trainee', can_manage: false, can_view: true, can_edit: false, can_comment: true },
    { project_id: project.id, organization_member_id: employerMember, project_role: 'Employer', can_manage: false, can_view: true, can_edit: false, can_comment: true }
  ]);

  const { data: sprint } = await admin.from('sprints').insert({
    organization_id: orgId,
    project_id: project.id,
    name: 'Iteration 1',
    status: 'ACTIVE',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }).select().single();

  const tasksToSeed = [
    { title: 'Define training modules', type: 'STORY', status: 'IN_PROGRESS', assignee: trainerMember },
    { title: 'Fix applicant portal UI', type: 'BUG', status: 'READY', assignee: employerMember },
    { title: 'Affiliation compliance check', type: 'SECURITY_TASK', status: 'IN_PROGRESS', assignee: instituteAdmin },
    { title: 'Submit assignment 1', type: 'TASK', status: 'QA_TESTING', assignee: traineeMember }
  ];

  for (const t of tasksToSeed) {
    const { data: task } = await admin.from('tasks').insert({
      organization_id: orgId,
      project_id: project.id,
      sprint_id: sprint.id,
      title: t.title,
      task_type: t.type,
      status: t.status,
      reporter_member_id: instituteAdmin,
      primary_assignee_member_id: t.assignee
    }).select().single();

    if (t.assignee) {
       await admin.from('task_assignees').insert({
         task_id: task.id,
         organization_member_id: t.assignee,
         assigned_by: instituteAdmin
       });
    }
  }

  await admin.from('bugs').insert({
    organization_id: orgId,
    project_id: project.id,
    title: 'Trainee login timeout',
    severity: 'HIGH',
    status: 'OPEN',
    reporter_member_id: traineeMember,
    assignee_member_id: trainerMember
  });

  await admin.from('security_reviews').insert({
    organization_id: orgId,
    project_id: project.id,
    title: 'Q3 Affiliation Audit',
    status: 'PENDING',
    risk_score: 45,
    reviewer_member_id: superAdmin
  });
}
