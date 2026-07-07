import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateSoloWorkspaceInput, CreateStudentTeamInput } from '@/lib/validation/student-team';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { Errors } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createStudentSoloWorkspace(
  supabase: SupabaseClient,
  userId: string,
  input: CreateSoloWorkspaceInput,
) {
  const { data, error } = await createAdminClient().rpc('create_student_solo_workspace', {
    p_user_id: userId,
    p_name: input.name,
    p_description: input.description ?? null,
  });
  if (error) throw Errors.internal(error.message);

  await createAuditLog(supabase, {
    organizationId: data.id,
    action: 'student_workspace.created',
    entityType: 'organization',
    entityId: data.id,
    afterState: { name: data.name, workspace_type: 'STUDENT_SOLO' },
  });
  return data;
}

export async function createStudentTeam(
  supabase: SupabaseClient,
  userId: string,
  input: CreateStudentTeamInput,
) {
  const { data, error } = await createAdminClient().rpc('create_student_team', {
    p_user_id: userId,
    p_name: input.name,
    p_event_name: input.eventName ?? null,
    p_short_description: input.shortDescription ?? null,
    p_expected_team_size: input.expectedTeamSize ?? null,
    p_max_team_size: input.maxTeamSize,
    p_primary_team_role: input.primaryTeamRole ?? null,
  });
  if (error) throw Errors.internal(error.message);

  const row = Array.isArray(data) ? data[0] : data;

  await createAuditLog(supabase, {
    organizationId: row.out_organization_id,
    action: 'student_team.created',
    entityType: 'organization',
    entityId: row.out_organization_id,
    afterState: { name: row.out_name, workspace_type: 'STUDENT_TEAM' },
  });

  return {
    organizationId: row.out_organization_id as string,
    name: row.out_name as string,
    slug: row.out_slug as string,
    joinCode: row.raw_join_code as string,
  };
}

export async function rotateJoinCode(supabase: SupabaseClient, userId: string, organizationId: string) {
  const { data, error } = await createAdminClient().rpc('rotate_join_code', {
    p_org: organizationId,
    p_caller_user_id: userId,
  });
  if (error) {
    if (error.message?.includes('FORBIDDEN')) throw Errors.forbidden();
    throw Errors.internal(error.message);
  }

  await createAuditLog(supabase, {
    organizationId,
    action: 'student_team.join_code_rotated',
    entityType: 'organization',
    entityId: organizationId,
    afterState: { rotated: true },
  });
  return data as string;
}

export async function revokeJoinCode(supabase: SupabaseClient, userId: string, organizationId: string) {
  const { error } = await createAdminClient().rpc('revoke_join_code', {
    p_org: organizationId,
    p_caller_user_id: userId,
  });
  if (error) {
    if (error.message?.includes('FORBIDDEN')) throw Errors.forbidden();
    throw Errors.internal(error.message);
  }

  await createAuditLog(supabase, {
    organizationId,
    action: 'student_team.join_code_revoked',
    entityType: 'organization',
    entityId: organizationId,
    afterState: { revoked: true },
  });
}

export async function getJoinCodeStatus(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase.rpc('get_join_code_status', { p_org: organizationId });
  if (error) throw Errors.internal(error.message);
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function previewJoinCode(code: string) {
  const { data, error } = await createAdminClient().rpc('preview_join_code', { p_raw_code: code });
  if (error) throw Errors.internal(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw Errors.notFound('Invalid or expired join code.');
  return { teamName: row.team_name, eventName: row.event_name, availableSpots: row.available_spots };
}

/** Lead + (Co-Leads, only if the team's member-management toggle is on) —
 * the same recipient set the DELETE-member route already uses to decide who
 * may manage membership, reused here for who gets notified about it. */
async function getMembershipManagers(organizationId: string) {
  const admin = createAdminClient();
  const [{ data: members }, { data: settings }] = await Promise.all([
    admin
      .from('organization_members')
      .select('id, member_roles!member_roles_organization_member_id_fkey ( roles ( code ) )')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    admin
      .from('student_team_settings')
      .select('co_lead_can_manage_members, max_team_size')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);

  const leadMemberIds: string[] = [];
  const coLeadMemberIds: string[] = [];
  for (const m of members ?? []) {
    // @ts-ignore - Supabase join typing
    const codes: string[] = (m.member_roles || []).map((mr) => mr.roles?.code).filter(Boolean);
    if (codes.includes('STUDENT_TEAM_LEAD')) leadMemberIds.push(m.id);
    else if (codes.includes('STUDENT_CO_LEAD')) coLeadMemberIds.push(m.id);
  }

  return {
    recipients: settings?.co_lead_can_manage_members ? [...leadMemberIds, ...coLeadMemberIds] : leadMemberIds,
    memberCount: (members ?? []).length,
    maxTeamSize: settings?.max_team_size ?? null,
  };
}

/** Notify a set of members via the existing create_notification RPC — the
 * same mechanism comment.service.ts/approval.service.ts already use, so
 * delivery (Inbox + live notification-bell update) needs no new plumbing.
 * Never carries raw join codes or anything beyond {team name, event, target}. */
export async function notifyStudentTeamEvent(
  supabase: SupabaseClient,
  organizationId: string,
  recipientMemberIds: string[],
  type: string,
  title: string,
  body: string,
) {
  await Promise.allSettled(recipientMemberIds.map((memberId) =>
    supabase.rpc('create_notification', {
      p_org: organizationId,
      p_recipient: memberId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_entity_type: 'organization',
      p_entity_id: organizationId,
      p_project_id: null,
      p_metadata: {},
    }),
  ));
}

export async function redeemJoinCode(supabase: SupabaseClient, userId: string, code: string) {
  const { data, error } = await createAdminClient().rpc('redeem_student_team_join_code', {
    p_user_id: userId,
    p_raw_code: code,
  });
  if (error) {
    if (error.message?.includes('ALREADY_MEMBER')) throw Errors.conflict('You are already a member of this team.');
    if (error.message?.includes('TEAM_FULL')) throw Errors.conflict('This team is full.');
    // INVALID_CODE and anything else: one generic message, never leaking specifics.
    throw Errors.validation('Invalid or expired join code.');
  }

  await createAuditLog(supabase, {
    organizationId: data.id,
    action: 'student_team.joined',
    entityType: 'organization',
    entityId: data.id,
  });

  // Best-effort lifecycle notifications — never block a successful join.
  try {
    const { recipients, memberCount, maxTeamSize } = await getMembershipManagers(data.id);
    await notifyStudentTeamEvent(
      supabase, data.id, recipients, 'STUDENT_TEAM_MEMBER_JOINED',
      `New member joined ${data.name}`, 'A new member has joined your student team.',
    );
    if (maxTeamSize !== null && memberCount === maxTeamSize) {
      await notifyStudentTeamEvent(
        supabase, data.id, recipients, 'STUDENT_TEAM_CAPACITY_REACHED',
        `${data.name} is now full`, `Your team has reached its maximum size of ${maxTeamSize}.`,
      );
    }
  } catch { /* notification failures never block the join */ }

  return data;
}

export async function transferLeadership(
  supabase: SupabaseClient,
  fromUserId: string,
  organizationId: string,
  toMemberId: string,
  demoteTo: 'STUDENT_CO_LEAD' | 'STUDENT_MEMBER',
) {
  const { error } = await createAdminClient().rpc('transfer_team_leadership', {
    p_org: organizationId,
    p_from_user_id: fromUserId,
    p_to_member_id: toMemberId,
    p_demote_to: demoteTo,
  });
  if (error) {
    if (error.message?.includes('FORBIDDEN')) throw Errors.forbidden();
    if (error.message?.includes('INVALID_TARGET_MEMBER')) throw Errors.validation('Invalid target member.');
    throw Errors.internal(error.message);
  }

  await createAuditLog(supabase, {
    organizationId,
    action: 'student_team.leadership_transferred',
    entityType: 'organization',
    entityId: organizationId,
    afterState: { toMemberId, demoteTo },
  });
}
