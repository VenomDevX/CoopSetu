import { NextRequest } from 'next/server';
import { handle, ok, fail } from '@/lib/api/response';
import { requireOrganization, hasPermission } from '@/lib/auth/require-organization';
import { getCallerInstitutionId } from '@/lib/auth/institution-scope';
import { createClient } from '@/lib/supabase/server';
import { istDayKey } from '@/lib/attendance/time';

/**
 * GET /api/v1/attendance/feed
 *
 * Unified live feed for all attendance surfaces. Returns joined records with
 * person name, method, status, marked_at (full precision), device name,
 * marked-by, session/course.
 *
 * Query params:
 *   scope    — SELF | BATCH | INSTITUTION | ORG | STAFF (default: auto from role)
 *   batch_id — filter by batch
 *   date     — filter by IST day (YYYY-MM-DD), defaults to today
 *   method   — filter by method (RFID, QR, FACE, MANUAL, TOTP)
 *   cursor   — keyset pagination (marked_at ISO string)
 *   limit    — page size (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const membership = await requireOrganization();
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;

    const scope = searchParams.get('scope') || 'auto';
    const batchId = searchParams.get('batch_id');
    const dateParam = searchParams.get('date') || istDayKey(new Date());
    const methodFilter = searchParams.get('method');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    // Build the query — RLS enforces scope, we just apply filters
    let query = supabase
      .from('attendance_records')
      .select(`
        id, session_id, trainee_id, member_id, method, status, marked_at, source,
        device_id, device_event_id, recorded_by_member_id,
        member:member_id (
          id, user_id, institution_id,
          profiles:user_id ( full_name, avatar_url )
        ),
        session:session_id (
          id, date, session_type, session_slot, batch_id,
          batches ( name, programme_id, programmes ( title ) )
        ),
        device:device_id (
          id, label, device_name, location
        )
      `)
      .order('marked_at', { ascending: false })
      .limit(limit);

    // Scope filtering
    if (scope === 'SELF') {
      query = query.eq('member_id', membership.memberId);
    } else if (scope === 'BATCH' && batchId) {
      // Filter by batch through session
      query = query.not('session_id', 'is', null);
    }

    // Date filter — filter by IST day using timestamptz range
    if (dateParam) {
      const dayStart = `${dateParam}T00:00:00+05:30`;
      const dayEnd = `${dateParam}T23:59:59.999+05:30`;
      query = query.gte('marked_at', dayStart).lte('marked_at', dayEnd);
    }

    // Method filter
    if (methodFilter) {
      query = query.eq('method', methodFilter);
    }

    // Keyset pagination
    if (cursor) {
      query = query.lt('marked_at', cursor);
    }

    const { data, error } = await query;
    if (error) {
      return fail('INTERNAL', error.message, 500);
    }

    // Post-filter by batch if needed (session.batch_id)
    let records = data || [];
    if (scope === 'BATCH' && batchId) {
      records = records.filter((r: any) =>
        r.session && (r.session as any).batch_id === batchId
      );
    }

    // Build the next cursor
    const nextCursor = records.length === limit
      ? records[records.length - 1].marked_at
      : null;

    return ok({
      records: records.map((r: any) => ({
        id: r.id,
        memberId: r.member_id,
        memberName: r.member?.profiles?.full_name ?? 'Unknown',
        memberAvatar: r.member?.profiles?.avatar_url ?? null,
        method: r.method,
        status: r.status,
        markedAt: r.marked_at,
        source: r.source,
        sessionType: r.session?.session_type ?? null,
        sessionSlot: r.session?.session_slot ?? null,
        batchName: r.session?.batches?.name ?? null,
        courseTitle: r.session?.batches?.programmes?.title ?? null,
        deviceName: r.device?.device_name ?? r.device?.label ?? null,
        deviceLocation: r.device?.location ?? null,
      })),
      nextCursor,
      date: dateParam,
    });
  });
}
