import { NextRequest, NextResponse } from 'next/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Individual device management — authenticated admin only.
 *
 * PATCH: Update device metadata (label, device_name, location, status)
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

    const { id } = await params;
    const body = await request.json();
    const { label, device_name, location, status, institution_id } = body;

    const admin = createAdminClient();

    // Verify the device belongs to the same organization
    const { data: device } = await admin
      .from('device_tokens')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    if (label !== undefined) updates.label = label;
    if (device_name !== undefined) updates.device_name = device_name;
    if (location !== undefined) updates.location = location;
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
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
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

    const { id } = await params;
    const admin = createAdminClient();

    // Verify ownership before revoking
    const { data: device } = await admin
      .from('device_tokens')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();

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
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
