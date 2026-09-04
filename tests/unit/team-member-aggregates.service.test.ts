import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTeamAggregates } from '@/services/team.service';
import { getMemberAggregates } from '@/services/member.service';
import type { SupabaseClient } from '@supabase/supabase-js';

function mockFrom(tables: Record<string, any>) {
  return vi.fn((table: string) => {
    if (!(table in tables)) throw new Error(`unexpected table ${table}`);
    return tables[table];
  });
}

describe('getTeamAggregates() — derived, never fabricated, team metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the empty aggregate for every team when given no team ids', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    const result = await getTeamAggregates(supabase, []);
    expect(result).toEqual({});
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('counts only ACTIVE linked projects, and derives health as the worst of them', async () => {
    const supabase = {
      from: mockFrom({
        project_teams: {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { team_id: 't1', project_id: 'p1', projects: { status: 'ACTIVE', health: 'ON_TRACK' } },
                { team_id: 't1', project_id: 'p2', projects: { status: 'ACTIVE', health: 'AT_RISK' } },
                { team_id: 't1', project_id: 'p3', projects: { status: 'COMPLETED', health: 'OFF_TRACK' } }, // not ACTIVE — excluded
                { team_id: 't2', project_id: 'p4', projects: { status: 'ACTIVE', health: 'OFF_TRACK' } },
              ],
              error: null,
            }),
          }),
        },
        bugs: {
          select: () => ({ in: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
        },
        sprints: {
          select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        },
      }),
    } as unknown as SupabaseClient;

    const result = await getTeamAggregates(supabase, ['t1', 't2']);

    expect(result.t1.projects).toBe(2); // only the two ACTIVE ones
    expect(result.t1.health).toBe('At Risk'); // worst of ON_TRACK/AT_RISK
    expect(result.t2.projects).toBe(1);
    expect(result.t2.health).toBe('Critical'); // OFF_TRACK
  });

  it('a team with no active projects gets health: null, never a fabricated default', async () => {
    const supabase = {
      from: mockFrom({
        project_teams: { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) },
        bugs: { select: () => ({ in: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) },
        sprints: { select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) },
      }),
    } as unknown as SupabaseClient;

    const result = await getTeamAggregates(supabase, ['t1']);
    expect(result.t1).toEqual({ projects: 0, openBugs: 0, velocity: 0, health: null, sprintName: null, sprintProgress: null });
  });

  it('openBugs counts only OPEN/IN_PROGRESS bugs scoped to the team\'s own linked projects', async () => {
    const supabase = {
      from: mockFrom({
        project_teams: {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { team_id: 't1', project_id: 'p1', projects: { status: 'ACTIVE', health: 'ON_TRACK' } },
                { team_id: 't2', project_id: 'p2', projects: { status: 'ACTIVE', health: 'ON_TRACK' } },
              ],
              error: null,
            }),
          }),
        },
        bugs: {
          select: () => ({
            in: () => ({
              in: () => Promise.resolve({ data: [{ project_id: 'p1' }, { project_id: 'p1' }, { project_id: 'p2' }], error: null }),
            }),
          }),
        },
        sprints: { select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) },
      }),
    } as unknown as SupabaseClient;

    const result = await getTeamAggregates(supabase, ['t1', 't2']);
    expect(result.t1.openBugs).toBe(2);
    expect(result.t2.openBugs).toBe(1);
  });

  it('velocity is the most recently COMPLETED sprint\'s completed_story_points; sprintProgress comes from the ACTIVE sprint', async () => {
    const supabase = {
      from: mockFrom({
        project_teams: { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) },
        bugs: { select: () => ({ in: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) },
        sprints: {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({
                data: [
                  // Already sorted most-recent-first, as the real query orders by start_date desc.
                  { team_id: 't1', name: 'Sprint 5', status: 'ACTIVE', planned_story_points: 40, completed_story_points: 10 },
                  { team_id: 't1', name: 'Sprint 4', status: 'COMPLETED', planned_story_points: 30, completed_story_points: 28 },
                  { team_id: 't1', name: 'Sprint 3', status: 'COMPLETED', planned_story_points: 30, completed_story_points: 20 },
                ],
                error: null,
              }),
            }),
          }),
        },
      }),
    } as unknown as SupabaseClient;

    const result = await getTeamAggregates(supabase, ['t1']);
    expect(result.t1.sprintName).toBe('Sprint 5');
    expect(result.t1.sprintProgress).toBe(25); // 10/40
    expect(result.t1.velocity).toBe(28); // most recent COMPLETED, not the older one
  });
});

describe('getMemberAggregates() — derived, never fabricated, per-member metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the empty aggregate for every member when given no member ids', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    const result = await getMemberAggregates(supabase, []);
    expect(result).toEqual({});
  });

  it('counts only non-DONE/CANCELLED, non-archived tasks, and sums their estimated_hours as workload', async () => {
    const supabase = {
      from: mockFrom({
        task_assignees: {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { organization_member_id: 'm1', tasks: { status: 'IN_PROGRESS', estimated_hours: 8, archived_at: null } },
                { organization_member_id: 'm1', tasks: { status: 'DONE', estimated_hours: 100, archived_at: null } }, // excluded: DONE
                { organization_member_id: 'm1', tasks: { status: 'BLOCKED', estimated_hours: 5, archived_at: '2026-01-01' } }, // excluded: archived
                { organization_member_id: 'm2', tasks: { status: 'READY', estimated_hours: null, archived_at: null } },
              ],
              error: null,
            }),
          }),
        },
        audit_logs: {
          select: () => ({ in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
        },
      }),
    } as unknown as SupabaseClient;

    const result = await getMemberAggregates(supabase, ['m1', 'm2']);
    expect(result.m1.activeTasks).toBe(1);
    expect(result.m1.workload).toBe(8);
    expect(result.m2.activeTasks).toBe(1);
    expect(result.m2.workload).toBe(0); // null estimated_hours treated as 0, not NaN
  });

  it('caps recentActivity at 5 items per member, most-recent first', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      actor_member_id: 'm1', action: `task.updated_${i}`, created_at: `2026-01-0${i + 1}T00:00:00Z`,
    }));
    const supabase = {
      from: mockFrom({
        task_assignees: { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) },
        audit_logs: {
          select: () => ({ in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }) }) }),
        },
      }),
    } as unknown as SupabaseClient;

    const result = await getMemberAggregates(supabase, ['m1']);
    expect(result.m1.recentActivity.length).toBe(5);
    expect(result.m1.recentActivity[0].action).toBe('task.updated_0');
  });
});
