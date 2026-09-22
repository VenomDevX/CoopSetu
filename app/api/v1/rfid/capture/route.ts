import { NextRequest } from 'next/server';
import { handle, ok, fail } from '@/lib/api/response';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { getCallerInstitutionId } from '@/lib/auth/institution-scope';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/v1/rfid/capture — Terminal publishes a scanned UID for tap-to-capture.
 * GET  /api/v1/rfid/capture — Dashboard polls for pending captures.
 *
 * Flow:
 *   1. Admin opens RFID Registration page, clicks "Tap to Capture"
 *   2. Terminal scans a card, POSTs the UID here
 *   3. Dashboard polls GET, sees the UID, assigns it to a member
 */

export async function POST(request: NextRequest) {
  return handle(async () => {
    const device = await authenticateDevice(request);
    const body = await request.json();
    const admin = createAdminClient();

    if (!device) {
      const membership = await requireOrganization();
      requirePermission(membership, 'attendance:manage');
      const deviceId = typeof body.device_id === 'string' ? body.device_id : '';
      if (!deviceId) return fail('BAD_REQUEST', 'device_id is required', 400);

      const callerInstitutionId = await getCallerInstitutionId(membership.memberId);
      let deviceQuery = admin
        .from('device_tokens')
        .select('id, institution_id')
        .eq('id', deviceId)
        .eq('organization_id', membership.organizationId)
        .eq('status', 'ACTIVE');
      if (callerInstitutionId) deviceQuery = deviceQuery.eq('institution_id', callerInstitutionId);
      const { data: targetDevice } = await deviceQuery.maybeSingle();
      if (!targetDevice) return fail('FORBIDDEN', 'Device is outside your attendance scope', 403);

      await admin.from('rfid_capture_requests').update({ status: 'EXPIRED' })
        .eq('device_id', deviceId).in('status', ['WAITING', 'CAPTURED']);

      const { data: waiting, error: waitingError } = await admin
        .from('rfid_capture_requests')
        .insert({
          organization_id: membership.organizationId,
          institution_id: targetDevice.institution_id,
          device_id: deviceId,
          requested_by: membership.memberId,
          status: 'WAITING',
        })
        .select('id, expires_at')
        .single();
      if (waitingError) return fail('INTERNAL', 'Could not start RFID capture', 500);
      return ok({ id: waiting.id, status: 'WAITING', expiresAt: waiting.expires_at }, undefined, 201);
    }

    const { rfid_uid } = body;
    if (!rfid_uid || typeof rfid_uid !== 'string') {
      return fail('BAD_REQUEST', 'rfid_uid is required', 400);
    }
    const normalizedUid = rfid_uid.toUpperCase().trim();

    // Expire old requests for this device
    await admin
      .from('rfid_capture_requests')
      .update({ status: 'EXPIRED' })
      .eq('device_id', device.id)
      .eq('status', 'WAITING')
      .lt('expires_at', new Date().toISOString());

    const { data: pending } = await admin
      .from('rfid_capture_requests')
      .select('id')
      .eq('device_id', device.id)
      .eq('status', 'WAITING')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending) {
      const { error: updateError } = await admin
        .from('rfid_capture_requests')
        .update({ rfid_uid: normalizedUid, status: 'CAPTURED' })
        .eq('id', pending.id);
      if (updateError) return fail('INTERNAL', 'Could not publish RFID capture', 500);
      return ok({ id: pending.id, rfid_uid: normalizedUid }, undefined, 201);
    }

    const { data: fresh, error: freshErr } = await admin
        .from('rfid_capture_requests')
        .insert({
          organization_id: device.organizationId,
          institution_id: device.institutionId,
          device_id: device.id,
          rfid_uid: normalizedUid,
          status: 'CAPTURED',
          expires_at: new Date(Date.now() + 2 * 60_000).toISOString(),
        })
        .select('id')
        .single();
    if (freshErr) return fail('INTERNAL', 'Could not publish RFID capture', 500);
    return ok({ id: fresh.id, rfid_uid: normalizedUid }, undefined, 201);
  });
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const membership = await requireOrganization();
    requirePermission(membership, 'attendance:manage');
    const body = await request.json();
    if (typeof body.id !== 'string') return fail('BAD_REQUEST', 'id is required', 400);
    const admin = createAdminClient();
    const callerInstitutionId = await getCallerInstitutionId(membership.memberId);
    let claimQuery = admin.from('rfid_capture_requests')
      .update({ status: 'CLAIMED' })
      .eq('id', body.id)
      .eq('organization_id', membership.organizationId)
      .eq('status', 'CAPTURED');
    if (callerInstitutionId) claimQuery = claimQuery.eq('institution_id', callerInstitutionId);
    const { data, error } = await claimQuery.select('id').maybeSingle();
    if (error) return fail('INTERNAL', 'Could not claim RFID capture', 500);
    if (!data) return fail('NOT_FOUND', 'Capture was not found or already claimed', 404);
    return ok({ id: data.id, status: 'CLAIMED' });
  });
}

export async function GET(request: NextRequest) {
  return handle(async () => {
    const membership = await requireOrganization();
    requirePermission(membership, 'attendance:manage');

    const admin = createAdminClient();
    const callerInstitutionId = await getCallerInstitutionId(membership.memberId);
    const { searchParams } = request.nextUrl;
    const deviceId = searchParams.get('device_id');

    // Expire old requests
    await admin
      .from('rfid_capture_requests')
      .update({ status: 'EXPIRED' })
      .eq('organization_id', membership.organizationId)
      .in('status', ['WAITING', 'CAPTURED'])
      .lt('expires_at', new Date().toISOString());

    // Get recent captures
    let query = admin
      .from('rfid_capture_requests')
      .select(`
        id, rfid_uid, status, device_id, created_at, expires_at,
        device_tokens ( label, device_name )
      `)
      .eq('organization_id', membership.organizationId)
      .in('status', ['CAPTURED', 'WAITING'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (callerInstitutionId) {
      query = query.eq('institution_id', callerInstitutionId);
    }

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query;
    if (error) {
      return fail('INTERNAL', error.message, 500);
    }

    return ok({
      captures: (data || []).map((c: any) => ({
        id: c.id,
        rfidUid: c.rfid_uid,
        status: c.status,
        deviceId: c.device_id,
        deviceName: c.device_tokens?.device_name || c.device_tokens?.label || 'Unknown',
        createdAt: c.created_at,
        expiresAt: c.expires_at,
      })),
    });
  });
}
