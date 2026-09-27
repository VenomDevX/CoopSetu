import { NextRequest, NextResponse } from 'next/server';
import { legacyError } from '@/lib/api/response';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerInstitutionId, hasPermission } from '@/lib/auth/institution-scope';

/**
 * Individual device management — authenticated admin only.
 *
 * PATCH: Update device metadata (label, device_name, location, status,
 *        serial_number, institution_id)
 * DELETE: Revoke a device token permanently
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasPermission(membership, 'attendance:manage'))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { label, device_name, location, status, institution_id, serial_number } = body;

    const admin = createAdminClient();
    const callerInstitutionId = await getCallerInstitutionId(membership.memberId);

    // Verify the device belongs to the same organization, and — for an
    // institution-pinned admin — to their own institution.
    let deviceQuery = admin
      .from('device_tokens')
      .select('id, organization_id, institution_id')
      .eq('id', id)
      .eq('organization_id', membership.organizationId);
    if (callerInstitutionId) deviceQuery = deviceQuery.eq('institution_id', callerInstitutionId);
    const { data: device } = await deviceQuery.maybeSingle();

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // An institution-pinned admin cannot rebind a device to a different
    // institution — only a national-scope (SUPER_ADMIN) caller can do that.
    if (callerInstitutionId && institution_id !== undefined && institution_id !== callerInstitutionId) {
      return NextResponse.json({ error: 'Cannot assign a device outside your institution' }, { status: 403 });
    }

    const updates: Record<string, any> = {};
    if (label !== undefined) updates.label = label;
    if (device_name !== undefined) updates.device_name = device_name;
    if (location !== undefined) updates.location = location;
    if (serial_number !== undefined) updates.serial_number = serial_number || null;
    if (institution_id !== undefined) updates.institution_id = institution_id;
    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await admin
      .from('device_tokens')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Device update error:', error);
      return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Device updated' });

  } catch (err: any) {
    console.error('Device update error:', err);
    return legacyError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasPermission(membership, 'attendance:manage'))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const admin = createAdminClient();
    const callerInstitutionId = await getCallerInstitutionId(membership.memberId);

    // Verify ownership before revoking — an institution-pinned admin can only
    // revoke devices already bound to their own institution.
    let deviceQuery = admin
      .from('device_tokens')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', membership.organizationId);
    if (callerInstitutionId) deviceQuery = deviceQuery.eq('institution_id', callerInstitutionId);
    const { data: device } = await deviceQuery.maybeSingle();

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const { error } = await admin
      .from('device_tokens')
      .update({
        revoked_at: new Date().toISOString(),
        status: 'REVOKED',
      })
      .eq('id', id);

    if (error) {
      console.error('Device revoke error:', error);
      return NextResponse.json({ error: 'Failed to revoke device' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Device token revoked' });

  } catch (err: any) {
    console.error('Device revoke error:', err);
    return legacyError(err);
  }
}
