/**
 * Roles live in member_roles → roles, not on organization_members (which has
 * no `role` column). Device routes embed them with MEMBER_ROLES_EMBED and
 * collapse them to the single label the terminal displays.
 */

export const MEMBER_ROLES_EMBED = 'member_roles!organization_member_id ( roles ( code ) )';

// A member can hold several roles; the terminal shows one. Attendance-relevant
// roles win over administrative ones.
const DISPLAY_PRIORITY = ['TRAINEE', 'TRAINER', 'EMPLOYER', 'INSTITUTE_ADMIN'];

type RoleRef = { code: string } | { code: string }[] | null | undefined;

export function memberRoleCodes(member: { member_roles?: { roles: RoleRef }[] | null } | null | undefined): string[] {
  return (member?.member_roles ?? [])
    .map((mr) => (Array.isArray(mr.roles) ? mr.roles[0]?.code : mr.roles?.code))
    .filter((c): c is string => !!c);
}

export function memberRoleCode(member: Parameters<typeof memberRoleCodes>[0]): string | null {
  const codes = memberRoleCodes(member);
  return DISPLAY_PRIORITY.find((r) => codes.includes(r)) ?? codes[0] ?? null;
}
