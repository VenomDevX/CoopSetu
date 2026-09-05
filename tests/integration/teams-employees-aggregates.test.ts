import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { listTeams, getTeamAggregates } from '@/services/team.service';
import { listMembers, getMemberAggregates } from '@/services/member.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

/**
 * Phase 6: app/dashboard/teams/page.tsx used to hardcode projects/velocity/
 * openBugs/health (team) and activeTasks/workload/recentActivity (employee)
 * to 0/'Healthy'/'—' regardless of real data. These tests prove the real
 * aggregation functions those hardcodes were replaced with actually compute
 * from real joins under real RLS, not just against mocked chains (see the
 * unit tests in tests/unit/team-member-aggregates.service.test.ts for the
 * pure-logic cases this file doesn't re-cover).
 *
 * Note on "removed fields no longer appear": `skills`/`location`/`github`
 * were never real API/DB fields to begin with — the old page hardcoded them
 * as client-side constants (`skills: []`, `location: '—'`), not something
 * a service ever returned. There is nothing at the API layer to assert their
 * absence against; the meaningful regression guard is that the *real*
 * replacement fields below are populated correctly.
 */
describe('Teams/Employees aggregates against real RLS', () => {
  let admin: SupabaseClient, owner: SupabaseClient;
  let teamId: string, memberId: string;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    owner = await asUser('owner@apexfintech.test'); // ORG_OWNER: implicitly holds every permission

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const must = <T,>(label: string, res: { data: T | null; error: { message: string } | null }): T => {
      if (res.error) throw new Error(`${label}: ${res.error.message}`);
      if (!res.data) throw new Error(`${label}: no data returned`);
      return res.data;
    };

    const dept = must('departments insert', await admin.from('departments')
      .insert({ organization_id: ORG, name: `Aggregates Test Dept ${suffix}` })
      .select('id').single());

    const team = must('teams insert', await admin.from('teams')
      .insert({ organization_id: ORG, department_id: (dept as any).id, name: `Aggregates Test Team ${suffix}`, capacity_hours_per_week: 120 })
      .select('id').single());
    teamId = (team as any).id;

    // Date.now() as decimal shares a long, slow-changing leading prefix
    // across close-together runs — base36 (and the random suffix) avoids
    // colliding with projects.organization_id_code unique constraint.
    const code = `AGG${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const project = must('projects insert', await admin.from('projects')
      .insert({ organization_id: ORG, name: `Aggregates Test Project ${suffix}`, code, status: 'ACTIVE', health: 'AT_RISK' })
      .select('id').single());
    const projectId = (project as any).id;

    must('project_teams insert', await admin.from('project_teams').insert({ project_id: projectId, team_id: teamId }).select('project_id').single());
    must('bugs insert', await admin.from('bugs').insert({ organization_id: ORG, project_id: projectId, title: 'Aggregates test bug', status: 'OPEN' }).select('id').single());

    const { error: sprintsError } = await admin.from('sprints').insert([
      { organization_id: ORG, project_id: projectId, team_id: teamId, name: 'Active Sprint', status: 'ACTIVE', planned_story_points: 40, completed_story_points: 10 },
      { organization_id: ORG, project_id: projectId, team_id: teamId, name: 'Completed Sprint', status: 'COMPLETED', planned_story_points: 30, completed_story_points: 25 },
    ]);
    if (sprintsError) throw new Error(`sprints insert: ${sprintsError.message}`);

    // A fresh org member: joins the team, gets one active task assignment
    // (with real estimated_hours) and one audit log entry as actor.
    const email = `aggregates-test-${suffix}@example.com`;
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email, password: process.env.TEST_USER_PASSWORD ?? 'testpass123', email_confirm: true,
    });
    if (authError || !authUser?.user) throw new Error(`createUser: ${authError?.message}`);

    const member = must('organization_members insert', await admin.from('organization_members')
      .insert({ organization_id: ORG, user_id: authUser.user.id, is_active: true })
      .select('id').single());
    memberId = (member as any).id;
    must('team_members insert', await admin.from('team_members').insert({ team_id: teamId, organization_member_id: memberId }).select('id').single());

    const task = must('tasks insert', await admin.from('tasks')
      .insert({ organization_id: ORG, project_id: projectId, title: 'Aggregates test task', status: 'IN_PROGRESS', estimated_hours: 12 })
      .select('id').single());
    const taskId = (task as any).id;
    must('task_assignees insert', await admin.from('task_assignees').insert({ task_id: taskId, organization_member_id: memberId }).select('id').single());

    must('audit_logs insert', await admin.from('audit_logs').insert({
      organization_id: ORG, actor_member_id: memberId, actor_type: 'USER', outcome: 'SUCCESS',
      action: 'task.status_changed', entity_type: 'task', entity_id: taskId,
    }).select('id').single());
  }, 60000);

  it('getTeamAggregates reflects the real project_teams/bugs/sprints joins for a seeded team', async () => {
    const teams = await listTeams(owner, ORG);
    expect(teams.some((t: any) => t.id === teamId)).toBe(true);

    const aggregates = await getTeamAggregates(owner, [teamId]);
    const agg = aggregates[teamId];

    expect(agg.projects).toBe(1);
    expect(agg.health).toBe('At Risk'); // derived from the real linked project's health, not a hardcoded default
    expect(agg.openBugs).toBe(1);
    expect(agg.sprintName).toBe('Active Sprint');
    expect(agg.sprintProgress).toBe(25); // 10/40
    expect(agg.velocity).toBe(25); // the completed sprint's completed_story_points
  });

  it('getMemberAggregates reflects the real task_assignees/tasks join and audit_logs for a seeded member', async () => {
    const members = await listMembers(owner, ORG);
    expect(members.some((m: any) => m.id === memberId)).toBe(true);

    const aggregates = await getMemberAggregates(owner, [memberId]);
    const agg = aggregates[memberId];

    expect(agg.activeTasks).toBe(1);
    expect(agg.workload).toBe(12); // the task's real estimated_hours
    expect(agg.recentActivity.some((a) => a.action === 'task.status_changed')).toBe(true);
  });
});
