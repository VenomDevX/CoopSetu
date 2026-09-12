import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';

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

    if (device) {
      orgId = device.organizationId;
    } else {
      const membership = await getCurrentMembership();
      if (!membership) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      orgId = membership.organizationId;
    }

    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const role = url.searchParams.get('role') || '';
    const institutionId = url.searchParams.get('institution_id') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

    // Override with query-param org_id only for device auth (terminal may pass it)
    const requestedOrgId = url.searchParams.get('organization_id');
    if (device && requestedOrgId && requestedOrgId !== orgId) {
      return NextResponse.json({ error: 'Organization mismatch' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Query organization_members joined with profiles for the name search
    let query = admin
      .from('organization_members')
      .select(`
        id, role, institution_id, is_active,
        profiles:user_id ( full_name, avatar_url )
      `)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .limit(limit);

    // Filter by role (map to organization_members role values)
    if (role) {
      const roleMap: Record<string, string> = {
        TRAINEE: 'TRAINEE',
        TRAINER: 'TRAINER',
        EMPLOYEE: 'EMPLOYEE',
        INSTITUTE_ADMIN: 'INSTITUTE_ADMIN',
      };
      const mappedRole = roleMap[role.toUpperCase()];
      if (mappedRole) {
        query = query.eq('role', mappedRole);
      }
    }

    // Filter by institution
    if (institutionId) {
      query = query.eq('institution_id', institutionId);
    }

    const { data: members, error } = await query;

    if (error) {
      console.error('User search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Apply name filter client-side (Supabase doesn't support ilike on joined tables easily)
    let results = (members || []).map((m: any) => ({
      id: m.id,
      name: m.profiles?.full_name ?? 'Unknown',
      avatar_url: m.profiles?.avatar_url ?? null,
      role: m.role,
      institution_id: m.institution_id,
    }));

    if (q) {
      const lower = q.toLowerCase();
      results = results.filter((r: any) => r.name.toLowerCase().includes(lower));
    }

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
      users: results,
      total: results.length,
    });

  } catch (err: any) {
    console.error('User search error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
