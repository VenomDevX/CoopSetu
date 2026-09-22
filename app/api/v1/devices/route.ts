import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerInstitutionId, hasPermission } from '@/lib/auth/institution-scope';
import { randomBytes, createHash } from 'node:crypto';

/**
 * Device management — authenticated admin only.
 *
 * GET:  List device tokens for the current organization, scoped to the
 *       caller's institution unless they have national scope.
 * POST: Issue a new device token (shows plaintext once).
 *
 * Both use the service-role client (device_tokens has no SELECT policy for
 * ordinary reads), so institution scoping and the attendance:manage gate are
 * enforced here in application code rather than by RLS.
 */

export async function GET(_request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasPermission(membership, 'attendance:manage'))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const admin = createAdminClient();
    const callerInstitutionId = await getCallerInstitutionId(membership.memberId);

    let query = admin
      .from('device_tokens')
      .select(`
        id, label, device_name, location, status, serial_number,
        token_hint, institution_id, last_seen_at, revoked_at, created_at,
        firmware_version, telemetry, last_boot_at, last_reset_reason,
        institutions:institution_id ( name )
      `)
      .eq('organization_id', membership.organizationId)
      .order('created_at', { ascending: false });

    // Institution-pinned admins only ever see their own institution's devices.
    if (callerInstitutionId) query = query.eq('institution_id', callerInstitutionId);

    const { data: devices, error } = await query;

    if (error) {
      console.error('Device list error:', error);
      return NextResponse.json({ error: 'Failed to list devices' }, { status: 500 });
    }

    return NextResponse.json({
      devices: (devices || []).map((d: any) => ({
        id: d.id,
        label: d.label,
        device_name: d.device_name,
        location: d.location,
        status: d.status,
        serial_number: d.serial_number,
        token_hint: d.token_hint,
        institution: d.institutions?.name ?? null,
        institution_id: d.institution_id,
        last_seen_at: d.last_seen_at,
        revoked_at: d.revoked_at,
        created_at: d.created_at,
        firmware_version: d.firmware_version,
        telemetry: d.telemetry,
        last_boot_at: d.last_boot_at,
        last_reset_reason: d.last_reset_reason,
        is_online: d.last_seen_at
          ? (Date.now() - new Date(d.last_seen_at).getTime()) < 5 * 60 * 1000
          : false,
      })),
    });

  } catch (err: any) {
    console.error('Device list error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasPermission(membership, 'attendance:manage'))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { label, device_name, location, institution_id, serial_number } = body;

    if (!label || typeof label !== 'string') {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    // An institution-pinned admin can only issue devices for their own
    // institution — ignore/reject any other institution_id they send.
    const callerInstitutionId = await getCallerInstitutionId(membership.memberId);
    if (callerInstitutionId && institution_id && institution_id !== callerInstitutionId) {
      return NextResponse.json({ error: 'Cannot assign a device outside your institution' }, { status: 403 });
    }
    const resolvedInstitutionId = callerInstitutionId || institution_id || null;

    // Generate a secure token
    const plaintext = `cst_${randomBytes(24).toString('hex')}`;
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const tokenHint = plaintext.slice(-4);

    const admin = createAdminClient();

    const { data: device, error } = await admin
      .from('device_tokens')
      .insert({
        organization_id: membership.organizationId,
        institution_id: resolvedInstitutionId,
        label,
        device_name: device_name || null,
        location: location || null,
        serial_number: serial_number || null,
        token_hash: tokenHash,
        token_hint: tokenHint,
        created_by: auth.user.id,
        status: 'ACTIVE',
      })
      .select('id, label, token_hint, serial_number, created_at')
      .single();

    if (error) {
      console.error('Device create error:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That serial number is already registered' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create device token' }, { status: 500 });
    }

    // Return the plaintext ONCE — it will never be recoverable
    return NextResponse.json({
      success: true,
      message: 'Device token created. Save the token now — it will not be shown again.',
      device: {
        id: device.id,
        label: device.label,
        token_hint: device.token_hint,
        serial_number: device.serial_number,
        created_at: device.created_at,
      },
      token: plaintext,
    }, { status: 201 });

  } catch (err: any) {
    console.error('Device create error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
