import { NextRequest, NextResponse } from 'next/server';
import { legacyError } from '@/lib/api/response';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { MEMBER_ROLES_EMBED, memberRoleCode } from '@/lib/auth/member-role';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { hasPermission } from '@/lib/auth/require-organization';
import { ADMIN_ROLES, type RoleCode } from '@/lib/constants/roles';

/**
 * User search — for RFID registration flows.
 *
 * Thin wrapper over the existing trainee/trainer/employer tables, filtered by
 * institution and role. Used by:
 *   - The terminal's on-device admin RFID registration (Phase 1G)
 *   - The web dashboard's RFID Registration page (Phase 3C)
 *
 * Query params:
 *   q             — search term (matches full_name)
 *   role          — TRAINEE | TRAINER | EMPLOYEE (optional filter)
 *   institution_id — scope to a specific institution (optional)
 *   organization_id — required for device-auth, inferred from session otherwise
 *   limit         — max results (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    let orgId: string;
    // The caller's own institution pin, if any. null means national scope
    // (sees the whole organization); a value means the caller is confined to
    // that institution and cannot widen the search by passing their own
    // institution_id on the query string.
    let callerInstitutionId: string | null = null;

    const admin = createAdminClient();

    if (device) {
      orgId = device.organizationId;
      callerInstitutionId = device.institutionId;
    } else {
      const membership = await getCurrentMembership();
      if (!membership) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Member directory for RFID registration — staff only. Without this any
      // member (e.g. a trainee) could enumerate the whole organization.
      const isGlobalAdmin = membership.roles.some((r: string) => ADMIN_ROLES.includes(r as RoleCode));
      if (!isGlobalAdmin && !hasPermission(membership, 'attendance:manage')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      orgId = membership.organizationId;

      const { data: callerRow } = await admin
        .from('organization_members')
        .select('institution_id')
        .eq('id', membership.memberId)
        .maybeSingle();
      callerInstitutionId = callerRow?.institution_id ?? null;

      // Allow super admins and organization owners/admins to search across the whole workspace
      if (isGlobalAdmin) {
        callerInstitutionId = null;
      }
    }

    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const role = url.searchParams.get('role') || '';
    const compact = url.searchParams.get('compact') === '1';
    // A caller pinned to an institution can only ever search their own
    // institution — the client-supplied institution_id is only honoured for
    // a national-scope caller narrowing an org-wide search.
    const institutionId = callerInstitutionId ?? (url.searchParams.get('institution_id') || '');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 50);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // Override with query-param org_id only for device auth (terminal may pass it)
    const requestedOrgId = url.searchParams.get('organization_id');
    if (device && requestedOrgId && requestedOrgId !== orgId) {
      return NextResponse.json({ error: 'Organization mismatch' }, { status: 403 });
    }

    // Roles live in member_roles → roles. With a role filter the embed is
    // !inner so members without that role drop out of the result.
    const roleMap: Record<string, string> = {
      TRAINEE: 'TRAINEE',
      TRAINER: 'TRAINER',
      // The terminal's registration screen says EMPLOYEE; the role code is EMPLOYER.
      EMPLOYEE: 'EMPLOYER',
      EMPLOYER: 'EMPLOYER',
      INSTITUTE_ADMIN: 'INSTITUTE_ADMIN',
    };
    const mappedRole = role ? roleMap[role.toUpperCase()] : undefined;
    const rolesEmbed = mappedRole
      ? 'member_roles!organization_member_id!inner ( roles!inner ( code ) )'
      : MEMBER_ROLES_EMBED;

    let query = admin
      .from('organization_members')
      .select(`
        id, institution_id, is_active,
        ${rolesEmbed},
        profiles:user_id!inner ( full_name ),
        institutions:institution_id ( name )
      `, { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (mappedRole) {
      query = query.eq('member_roles.roles.code', mappedRole);
    }

    // Filter by institution
    if (institutionId) {
      query = query.eq('institution_id', institutionId);
    }

    if (q.trim()) {
      query = query.ilike('profiles.full_name', `%${q.trim()}%`);
    }

    const { data: members, error, count } = await query;

    if (error) {
      console.error('User search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    let results = (members || []).map((m: any) => ({
      id: m.id,
      name: m.profiles?.full_name ?? 'Unknown',
      // profiles has avatar_path (a private-bucket key), not a public URL.
      avatar_url: null,
      role: mappedRole ?? memberRoleCode(m),
      institution_id: m.institution_id,
      institution_name: m.institutions?.name ?? null,
    }));

    // For each result, check if they already have an RFID card
    if (results.length > 0) {
      const memberIds = results.map((r: any) => r.id);
      const { data: existingCards } = await admin
        .from('rfid_cards')
        .select('member_id, rfid_uid, status')
        .in('member_id', memberIds)
        .eq('status', 'ACTIVE');

      const cardMap = new Map((existingCards || []).map((c: any) => [c.member_id, c]));
      results = results.map((r: any) => ({
        ...r,
        has_rfid: cardMap.has(r.id),
        rfid_uid: cardMap.get(r.id)?.rfid_uid ?? null,
      }));
    }

    return NextResponse.json({
      users: compact
        ? results.map(({ id, name, has_rfid }: any) => ({ id, name, has_rfid }))
        : results,
      total: count ?? results.length,
      offset,
      has_more: offset + results.length < (count ?? results.length),
    });

  } catch (err: any) {
    console.error('User search error:', err);
    return legacyError(err);
  }
}
