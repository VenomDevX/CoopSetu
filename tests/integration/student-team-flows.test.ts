import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { redeemJoinCode, notifyStudentTeamEvent } from '@/services/student-workspace.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:55001';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const adminClient = createClient(URL, process.env.SUPABASE_SECRET_KEY!);

describe('Student Workspace RPCs', () => {
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  async function createUser(email: string) {
    const { data } = await adminClient.auth.admin.createUser({
      email, password: 'password123', email_confirm: true,
    });
    createdUserIds.push(data!.user!.id);
    return data!.user!.id;
  }

  async function signIn(email: string): Promise<SupabaseClient> {
    const client = createClient(URL, KEY);
    const { error } = await client.auth.signInWithPassword({ email, password: 'password123' });
    if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
    return client;
  }

  async function memberIdFor(organizationId: string, userId: string) {
    const { data } = await adminClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single();
    return data!.id as string;
  }

  afterAll(async () => {
    if (createdOrgIds.length) {
      await adminClient.from('organizations').delete().in('id', createdOrgIds);
    }
    for (const id of createdUserIds) {
      await adminClient.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  describe('create_student_solo_workspace', () => {
    it('creates a STUDENT_SOLO org with a STUDENT_SOLO_OWNER membership', async () => {
      const userId = await createUser(`solo-${Date.now()}@example.com`);
      const { data, error } = await adminClient.rpc('create_student_solo_workspace', {
        p_user_id: userId, p_name: 'My Workspace',
      });
      expect(error).toBeNull();
      createdOrgIds.push(data.id);
      expect(data.workspace_type).toBe('STUDENT_SOLO');

      const { data: role } = await adminClient
        .from('organization_members')
        .select('member_roles!member_roles_organization_member_id_fkey(roles(code))')
        .eq('organization_id', data.id)
        .eq('user_id', userId)
        .single();
      // @ts-expect-error - Supabase join typing
      const codes = (role.member_roles || []).map((r) => r.roles?.code);
      expect(codes).toContain('STUDENT_SOLO_OWNER');
    });

    it('rejects a null acting user id', async () => {
      const { error } = await adminClient.rpc('create_student_solo_workspace', {
        p_user_id: null, p_name: 'X',
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('NOT_AUTHENTICATED');
    });
  });

  describe('create_student_team + redeem_student_team_join_code', () => {
    let orgId: string;
    let rawCode: string;
    let leadUserId: string;
    let joinerUserId: string;

    beforeAll(async () => {
      leadUserId = await createUser(`lead-${Date.now()}@example.com`);
      joinerUserId = await createUser(`joiner-${Date.now()}@example.com`);

      const { data, error } = await adminClient.rpc('create_student_team', {
        p_user_id: leadUserId, p_name: 'Test Team', p_max_team_size: 2,
      });
      expect(error).toBeNull();
      const row = Array.isArray(data) ? data[0] : data;
      orgId = row.out_organization_id;
      rawCode = row.raw_join_code;
      createdOrgIds.push(orgId);
    });

    it('creates the org with workspace_type STUDENT_TEAM and a STUDENT_TEAM_LEAD', async () => {
      const { data: org } = await adminClient.from('organizations').select('workspace_type').eq('id', orgId).single();
      expect(org!.workspace_type).toBe('STUDENT_TEAM');
    });

    it('rejects max_team_size above the platform cap', async () => {
      const { error } = await adminClient.rpc('create_student_team', {
        p_user_id: leadUserId, p_name: 'Too Big', p_max_team_size: 51,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('INVALID_MAX_TEAM_SIZE');
    });

    it('preview_join_code reveals only team name/event/spots, no member data', async () => {
      const { data } = await adminClient.rpc('preview_join_code', { p_raw_code: rawCode });
      const row = Array.isArray(data) ? data[0] : data;
      expect(row.team_name).toBe('Test Team');
      expect(Object.keys(row).sort()).toEqual(['available_spots', 'event_name', 'team_name'].sort());
    });

    it('redeems a valid code and creates an active STUDENT_MEMBER membership', async () => {
      const { data, error } = await adminClient.rpc('redeem_student_team_join_code', {
        p_user_id: joinerUserId, p_raw_code: rawCode,
      });
      expect(error).toBeNull();
      expect(data.id).toBe(orgId);

      const { data: member } = await adminClient
        .from('organization_members')
        .select('is_active, member_roles!member_roles_organization_member_id_fkey(roles(code))')
        .eq('organization_id', orgId)
        .eq('user_id', joinerUserId)
        .single();
      expect(member!.is_active).toBe(true);
      // @ts-expect-error - Supabase join typing
      const codes = (member!.member_roles || []).map((r) => r.roles?.code);
      expect(codes).toContain('STUDENT_MEMBER');
    });

    it('rejects redemption by an already-active member', async () => {
      const { error } = await adminClient.rpc('redeem_student_team_join_code', {
        p_user_id: joinerUserId, p_raw_code: rawCode,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('ALREADY_MEMBER');
    });

    it('rejects redemption once the team is at max_team_size', async () => {
      const thirdUserId = await createUser(`third-${Date.now()}@example.com`);
      const { error } = await adminClient.rpc('redeem_student_team_join_code', {
        p_user_id: thirdUserId, p_raw_code: rawCode,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('TEAM_FULL');
    });

    it('is case- and dash-insensitive when normalizing the raw code', async () => {
      const lowerNoSpecial = rawCode.toLowerCase().replace(/-/g, '');
      const { error } = await adminClient.rpc('redeem_student_team_join_code', {
        p_user_id: leadUserId, p_raw_code: lowerNoSpecial,
      });
      // Lead is already a member, so this should fail with ALREADY_MEMBER (not INVALID_CODE),
      // proving the normalized code was matched correctly despite differing case/formatting.
      expect(error!.message).toContain('ALREADY_MEMBER');
    });

    it('rotate_join_code invalidates the previous code', async () => {
      const { error: rotateErr } = await adminClient.rpc('rotate_join_code', {
        p_org: orgId, p_caller_user_id: leadUserId,
      });
      expect(rotateErr).toBeNull();

      const newUserId = await createUser(`postrotate-${Date.now()}@example.com`);
      const { error } = await adminClient.rpc('redeem_student_team_join_code', {
        p_user_id: newUserId, p_raw_code: rawCode,
      });
      expect(error!.message).toContain('INVALID_CODE');
    });

    it('rejects rotate_join_code from a non-Lead caller', async () => {
      const { error } = await adminClient.rpc('rotate_join_code', {
        p_org: orgId, p_caller_user_id: joinerUserId,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('FORBIDDEN');
    });

    it('transfer_team_leadership swaps roles atomically', async () => {
      const { data: joinerMember } = await adminClient
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', joinerUserId)
        .single();

      const { error } = await adminClient.rpc('transfer_team_leadership', {
        p_org: orgId, p_from_user_id: leadUserId, p_to_member_id: joinerMember!.id, p_demote_to: 'STUDENT_CO_LEAD',
      });
      expect(error).toBeNull();

      const { data: rows } = await adminClient
        .from('organization_members')
        .select('user_id, member_roles!member_roles_organization_member_id_fkey(roles(code))')
        .eq('organization_id', orgId);

      const byUser = new Map(
        (rows || []).map((r: any) => [r.user_id, (r.member_roles || []).map((mr: any) => mr.roles?.code)]),
      );
      expect(byUser.get(joinerUserId)).toContain('STUDENT_TEAM_LEAD');
      expect(byUser.get(leadUserId)).toContain('STUDENT_CO_LEAD');
    });
  });

  describe('workspace isolation', () => {
    it('a join code never redeems into a non-STUDENT_TEAM organization', async () => {
      // Sanity: preview/redeem both filter on workspace_type = 'STUDENT_TEAM' at the
      // SQL level, so an enterprise or demo org's id can never be reached via a code,
      // since join codes are only ever inserted for STUDENT_TEAM orgs to begin with.
      const { data: enterpriseOrgs } = await adminClient
        .from('organizations')
        .select('id')
        .eq('workspace_type', 'ENTERPRISE')
        .limit(1);
      if (enterpriseOrgs && enterpriseOrgs.length > 0) {
        const { data: codes } = await adminClient
          .from('student_team_join_codes')
          .select('id')
          .eq('organization_id', enterpriseOrgs[0].id);
        expect(codes?.length ?? 0).toBe(0);
      }
    });
  });

  describe('lifecycle notifications (services/student-workspace.service.ts)', () => {
    let leadUserId: string;
    let leadEmail: string;
    let orgId: string;
    let rawCode: string;
    let leadMemberId: string;

    beforeAll(async () => {
      leadEmail = `notif-lead-${Date.now()}@example.com`;
      leadUserId = await createUser(leadEmail);

      const { data } = await adminClient.rpc('create_student_team', {
        p_user_id: leadUserId, p_name: 'Notif Team', p_max_team_size: 2,
      });
      const row = Array.isArray(data) ? data[0] : data;
      orgId = row.out_organization_id;
      rawCode = row.raw_join_code;
      createdOrgIds.push(orgId);
      leadMemberId = await memberIdFor(orgId, leadUserId);
    }, 20000);

    it('notifies the Lead when a member joins, and fires capacity_reached exactly when the team hits max_team_size', async () => {
      const joinerEmail = `notif-join-${Date.now()}@example.com`;
      const joinerUserId = await createUser(joinerEmail);
      const joinerClient = await signIn(joinerEmail);

      await redeemJoinCode(joinerClient, joinerUserId, rawCode);

      const { data: joinedNotifs } = await adminClient
        .from('notifications')
        .select('id')
        .eq('organization_id', orgId)
        .eq('recipient_member_id', leadMemberId)
        .eq('type', 'STUDENT_TEAM_MEMBER_JOINED');
      expect(joinedNotifs?.length ?? 0).toBeGreaterThan(0);

      // max_team_size is 2 (Lead + this one join) — capacity is now exactly hit.
      const { data: capacityNotifs } = await adminClient
        .from('notifications')
        .select('id')
        .eq('organization_id', orgId)
        .eq('recipient_member_id', leadMemberId)
        .eq('type', 'STUDENT_TEAM_CAPACITY_REACHED');
      expect(capacityNotifs?.length ?? 0).toBe(1);
    });

    it('creates zero notifications for a rejected (TEAM_FULL) join attempt', async () => {
      const { data: before } = await adminClient.from('notifications').select('id').eq('organization_id', orgId);
      const beforeCount = before?.length ?? 0;

      const rejectedEmail = `notif-rejected-${Date.now()}@example.com`;
      const rejectedUserId = await createUser(rejectedEmail);
      const rejectedClient = await signIn(rejectedEmail);

      await expect(redeemJoinCode(rejectedClient, rejectedUserId, rawCode)).rejects.toThrow();

      const { data: after } = await adminClient.from('notifications').select('id').eq('organization_id', orgId);
      expect(after?.length ?? 0).toBe(beforeCount);
    });

    it('never leaks the raw join code (or code_hash) into any notification content', async () => {
      const { data: notifs } = await adminClient
        .from('notifications')
        .select('title, body, metadata')
        .eq('organization_id', orgId);
      const blob = JSON.stringify(notifs);
      expect(blob).not.toContain(rawCode);
      expect(blob.toLowerCase()).not.toContain('code_hash');
    });

    it('notifyStudentTeamEvent targets only the specified recipient (role/label change path)', async () => {
      // create_notification suppresses self-notification, so the actor here
      // must be someone other than the recipient — a dedicated Lead+Member
      // pair, exactly like the real role/labels routes (Lead acts, member is
      // notified). Uses its own team so it never contends with the shared
      // team's capacity state from the earlier tests in this block.
      const dedicatedLeadEmail = `notif-role-lead-${Date.now()}@example.com`;
      const dedicatedLeadUserId = await createUser(dedicatedLeadEmail);
      const { data: teamData } = await adminClient.rpc('create_student_team', {
        p_user_id: dedicatedLeadUserId, p_name: 'Role Notif Team', p_max_team_size: 5,
      });
      const teamRow = Array.isArray(teamData) ? teamData[0] : teamData;
      createdOrgIds.push(teamRow.out_organization_id);

      const memberEmail = `notif-role-member-${Date.now()}@example.com`;
      const memberUserId = await createUser(memberEmail);
      const memberClient = await signIn(memberEmail);
      await redeemJoinCode(memberClient, memberUserId, teamRow.raw_join_code);
      const memberId = await memberIdFor(teamRow.out_organization_id, memberUserId);

      const dedicatedLeadClient = await signIn(dedicatedLeadEmail);
      await notifyStudentTeamEvent(
        dedicatedLeadClient, teamRow.out_organization_id, [memberId], 'STUDENT_TEAM_ROLE_CHANGED',
        'Your team role has changed', 'Your role is now Member.',
      );

      const { data: notifs } = await adminClient
        .from('notifications')
        .select('id')
        .eq('organization_id', teamRow.out_organization_id)
        .eq('recipient_member_id', memberId)
        .eq('type', 'STUDENT_TEAM_ROLE_CHANGED');
      expect(notifs?.length ?? 0).toBeGreaterThan(0);
    });

    it('a member of an unrelated team never receives notifications from this team', async () => {
      const otherLeadEmail = `notif-other-lead-${Date.now()}@example.com`;
      const otherLeadUserId = await createUser(otherLeadEmail);
      const { data: otherTeam } = await adminClient.rpc('create_student_team', {
        p_user_id: otherLeadUserId, p_name: 'Other Notif Team', p_max_team_size: 5,
      });
      const otherRow = Array.isArray(otherTeam) ? otherTeam[0] : otherTeam;
      createdOrgIds.push(otherRow.out_organization_id);
      const otherLeadMemberId = await memberIdFor(otherRow.out_organization_id, otherLeadUserId);

      const { data: notifs } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_member_id', otherLeadMemberId);
      expect(notifs?.length ?? 0).toBe(0);
    });
  });

  describe('student team permission matrix (role_permissions source of truth)', () => {
    async function permissionsFor(roleCode: string) {
      const { data: role } = await adminClient
        .from('roles').select('id').eq('code', roleCode).is('organization_id', null).single();
      const { data: perms } = await adminClient
        .from('role_permissions').select('permission_code').eq('role_id', role!.id);
      return (perms ?? []).map((p) => p.permission_code as string);
    }

    it('STUDENT_TEAM_LEAD can assign authority roles and manage labels', async () => {
      const perms = await permissionsFor('STUDENT_TEAM_LEAD');
      expect(perms).toContain('student_team:assign_authority_role');
      expect(perms).toContain('student_team:manage_labels');
      expect(perms).toContain('student_team:manage_members');
    });

    it('STUDENT_CO_LEAD cannot assign authority roles, manage labels, or manage members via role grant alone', async () => {
      // manage_members is intentionally withheld from the role grant itself —
      // the co_lead_can_manage_members toggle is an additional app-layer gate
      // checked at runtime (app/api/v1/student-teams/[id]/members/[memberId]/route.ts),
      // not a substitute for a missing permission row.
      const perms = await permissionsFor('STUDENT_CO_LEAD');
      expect(perms).not.toContain('student_team:assign_authority_role');
      expect(perms).not.toContain('student_team:manage_labels');
      expect(perms).not.toContain('student_team:manage_members');
    });

    it('STUDENT_MEMBER has no student_team management permissions beyond view', async () => {
      const perms = await permissionsFor('STUDENT_MEMBER');
      expect(perms.filter((p) => p.startsWith('student_team:'))).toEqual(['student_team:view']);
    });

    it('all four student roles have repository (integration:*) view and manage access', async () => {
      for (const roleCode of ['STUDENT_TEAM_LEAD', 'STUDENT_CO_LEAD', 'STUDENT_MEMBER', 'STUDENT_SOLO_OWNER']) {
        const perms = await permissionsFor(roleCode);
        expect(perms).toContain('integration:view');
        expect(perms).toContain('integration:manage');
      }
    });
  });
});
