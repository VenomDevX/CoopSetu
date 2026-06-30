import { createAdminClient } from '@/lib/supabase/admin';

export const DEMO_PERSONAS = [
  { role: 'ORG_ADMIN', email: 'demo-admin@handoff.local', name: 'Maya Patel', title: 'Organization Admin' },
  { role: 'PROJECT_MANAGER', email: 'demo-pm@handoff.local', name: 'Arjun Mehta', title: 'Project Manager' },
  { role: 'QA_ENGINEER', email: 'demo-qa@handoff.local', name: 'Nina Verma', title: 'QA Analyst' },
  { role: 'DEVELOPER', email: 'demo-dev@handoff.local', name: 'Rohan Singh', title: 'Developer' },
  { role: 'SECURITY_ENGINEER', email: 'demo-sec@handoff.local', name: 'Aisha Khan', title: 'Security Reviewer' },
];

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

    // Check if user exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let user = existingUsers.users.find(u => u.email === persona.email);

    if (!user) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: persona.email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { full_name: persona.name },
      });
      if (createError) throw new Error(`Failed to create dummy user: ${createError.message}`);
      user = newUser.user;
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
  const getMember = (role: string) => {
    return role === visitorRole ? visitorMemberId : dummyUserIds[role];
  };

  // We need to resolve the member UUIDs for these dummy users.
  const { data: orgMembers } = await admin.from('organization_members').select('id, user_id').eq('organization_id', orgId);
  
  const resolveMember = (role: string) => {
    const uid = role === visitorRole ? visitorUserId : dummyUserIds[role];
    return orgMembers.find((m: any) => m.user_id === uid)?.id;
  };

  const adminMember = resolveMember('ORG_ADMIN');
  const pmMember = resolveMember('PROJECT_MANAGER');
  const devMember = resolveMember('DEVELOPER');
  const qaMember = resolveMember('QA_ENGINEER');
  const secMember = resolveMember('SECURITY_ENGINEER');

  // Seed Projects
  const { data: project } = await admin.from('projects').insert({
    organization_id: orgId,
    name: 'Apex Web Portal',
    code: 'APEX',
    priority: 'HIGH',
    health: 'ON_TRACK',
    owner_member_id: adminMember,
    project_manager_member_id: pmMember,
    status: 'ACTIVE'
  }).select().single();

  // Project Members
  await admin.from('project_members').insert([
    { project_id: project.id, organization_member_id: pmMember, project_role: 'Manager', can_manage: true, can_view: true, can_edit: true, can_comment: true },
    { project_id: project.id, organization_member_id: devMember, project_role: 'Developer', can_manage: false, can_view: true, can_edit: true, can_comment: true },
    { project_id: project.id, organization_member_id: qaMember, project_role: 'QA', can_manage: false, can_view: true, can_edit: true, can_comment: true },
    { project_id: project.id, organization_member_id: secMember, project_role: 'Security', can_manage: false, can_view: true, can_edit: false, can_comment: true }
  ]);

  // Sprint
  const { data: sprint } = await admin.from('sprints').insert({
    organization_id: orgId,
    project_id: project.id,
    name: 'Sprint 1',
    status: 'ACTIVE',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }).select().single();

  // Tasks
  const tasksToSeed = [
    { title: 'Implement login page', type: 'STORY', status: 'IN_PROGRESS', assignee: devMember },
    { title: 'Fix mobile overflow', type: 'BUG', status: 'READY', assignee: devMember },
    { title: 'Security review of Auth', type: 'SECURITY_TASK', status: 'IN_PROGRESS', assignee: secMember },
    { title: 'Test checkout flow', type: 'TASK', status: 'QA_TESTING', assignee: qaMember }
  ];

  for (const t of tasksToSeed) {
    const { data: task } = await admin.from('tasks').insert({
      organization_id: orgId,
      project_id: project.id,
      sprint_id: sprint.id,
      title: t.title,
      task_type: t.type,
      status: t.status,
      reporter_member_id: pmMember,
      primary_assignee_member_id: t.assignee
    }).select().single();

    if (t.assignee) {
       await admin.from('task_assignees').insert({
         task_id: task.id,
         organization_member_id: t.assignee,
         assigned_by: pmMember
       });
    }
  }

  // Bugs and Reviews
  await admin.from('bugs').insert({
    organization_id: orgId,
    project_id: project.id,
    title: 'Authentication token expiry issue',
    severity: 'HIGH',
    status: 'OPEN',
    reporter_member_id: qaMember,
    assignee_member_id: devMember
  });

  await admin.from('security_reviews').insert({
    organization_id: orgId,
    project_id: project.id,
    title: 'Q3 Security Audit',
    status: 'PENDING',
    risk_score: 45,
    reviewer_member_id: secMember
  });
}
