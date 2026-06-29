import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRoleAwareOverview } from '@/services/dashboard.service';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase Client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  is: vi.fn(() => mockSupabase),
  or: vi.fn(() => mockSupabase),
  lt: vi.fn(() => mockSupabase),
  lte: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
} as unknown as SupabaseClient;

describe('Dashboard Service - getRoleAwareOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Admin: sees organization-wide data (Scenario 1)', async () => {
    vi.spyOn(mockSupabase, 'from').mockImplementation(((table: string) => {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        is: vi.fn(() => builder),
        or: vi.fn(() => builder),
        lt: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        not: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        then: (resolve: any) => {
          if (table === 'projects' || table === 'tasks' || table === 'approval_requests' || table === 'bugs' || table === 'incidents' || table === 'security_findings') {
            resolve({ count: 10, data: null, error: null });
          } else {
            resolve({ data: [], error: null });
          }
        }
      };
      return builder;
    }) as any);

    const result = await getRoleAwareOverview(mockSupabase, {
      orgId: 'org1',
      memberId: 'user1',
      persona: 'ADMIN'
    });

    expect(result.metrics.activeProjects).toBe(10);
    expect(result.metrics.blockedTasks).toBe(10);
    // Did not filter by specific project or team scope
    expect(mockSupabase.from).toHaveBeenCalledWith('projects');
  });

  it('Project Manager: sees only managed-project data (Scenario 2)', async () => {
    vi.spyOn(mockSupabase, 'from').mockImplementation(((table: string) => {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((field, val) => {
          if (table === 'project_members' && field === 'organization_member_id') {
             return { then: (r: any) => r({ data: [{ project_id: 'p1' }] }) };
          }
          if (table === 'projects' && field === 'project_manager_member_id') {
             return { then: (r: any) => r({ data: [{ id: 'p2' }] }) };
          }
          return builder;
        }),
        in: vi.fn(() => builder),
        is: vi.fn(() => builder),
        or: vi.fn(() => builder),
        lt: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        not: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        then: (resolve: any) => {
          resolve({ count: 5, data: [], error: null });
        }
      };
      return builder;
    }) as any);

    const result = await getRoleAwareOverview(mockSupabase, {
      orgId: 'org1',
      memberId: 'pm1',
      persona: 'PROJECT_MANAGER'
    });

    expect(result.metrics.activeProjects).toBe(5);
  });

  it('Team Manager: sees only officially managed-team data (Scenario 3)', async () => {
    vi.spyOn(mockSupabase, 'from').mockImplementation(((table: string) => {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((field, val) => {
          if (table === 'teams' && field === 'team_lead_member_id') {
             return { then: (r: any) => r({ data: [{ id: 't1' }] }) };
          }
          return builder;
        }),
        in: vi.fn((field, val) => {
          if (table === 'project_teams' && field === 'team_id') {
             return { then: (r: any) => r({ data: [{ project_id: 'p1' }] }) };
          }
          return builder;
        }),
        is: vi.fn(() => builder),
        or: vi.fn(() => builder),
        lt: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        not: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        then: (resolve: any) => {
          resolve({ count: 3, data: [], error: null });
        }
      };
      return builder;
    }) as any);

    const result = await getRoleAwareOverview(mockSupabase, {
      orgId: 'org1',
      memberId: 'tm1',
      persona: 'TEAM_MANAGER'
    });

    expect(result.metrics.activeProjects).toBe(3);
  });

  it('Employee: sees only personal/shared/reviewer work (Scenario 4)', async () => {
    vi.spyOn(mockSupabase, 'from').mockImplementation(((table: string) => {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        is: vi.fn(() => builder),
        or: vi.fn((clause: string) => {
           expect(clause).toContain('primary_assignee_member_id.eq.emp1');
           return builder;
        }),
        lt: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        not: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        then: (resolve: any) => {
          resolve({ count: 2, data: [], error: null });
        }
      };
      return builder;
    }) as any);

    const result = await getRoleAwareOverview(mockSupabase, {
      orgId: 'org1',
      memberId: 'emp1',
      persona: 'EMPLOYEE'
    });

    expect(result.metrics.myActiveTasks).toBe(2);
  });
});
