import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * RFID registration — dual-auth.
 *
 * Accepts either:
 *   1. An authenticated admin web session (dashboard RFID Registration page)
 *   2. A device bearer token (on-device admin flow, Phase 1G)
 *
 * Links an RFID UID to an organization_member. Supports register, replace
 * (revoke old + register new), and revoke actions.
 */
export async function POST(request: NextRequest) {
  try {
    const device = await authenticateDevice(request);
    let isAuthorized = !!device;
    let registeredBy: string | null = null;

    // If no device auth, check for a web session with attendance:manage
    if (!device) {
      const membership = await getCurrentMembership();
      if (!membership) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify the user has attendance:manage permission
      const admin = createAdminClient();
      const { data: perms } = await admin.rpc('has_permission', {
        p_org: membership.organizationId,
        p_perm: 'attendance:manage',
      });

      if (!perms) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      isAuthorized = true;
      registeredBy = auth.user.id;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action = 'register', rfid_uid, member_id, organization_id, institution_id } = body;

    const admin = createAdminClient();

    if (action === 'revoke') {
      if (!rfid_uid && !member_id) {
        return NextResponse.json({ error: 'rfid_uid or member_id required for revocation' }, { status: 400 });
      }

      const query = admin
        .from('rfid_cards')
        .update({ status: 'REVOKED', updated_at: new Date().toISOString() });

      if (rfid_uid) query.eq('rfid_uid', rfid_uid.toUpperCase().trim());
      else if (member_id) query.eq('member_id', member_id);

      const { error: revokeErr } = await query;

      if (revokeErr) {
        console.error('RFID revoke error:', revokeErr);
        return NextResponse.json({ error: 'Failed to revoke RFID card' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'RFID card revoked' });
    }

    // Register or replace
    if (!rfid_uid || !member_id || !organization_id) {
      return NextResponse.json({
        error: 'rfid_uid, member_id, and organization_id are required',
      }, { status: 400 });
    }

    const normalizedUid = rfid_uid.toUpperCase().trim();

    // Verify the member exists and belongs to the organization
    const { data: member, error: memberErr } = await admin
      .from('organization_members')
      .select('id, organization_id, institution_id, role')
      .eq('id', member_id)
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member not found in organization' }, { status: 404 });
    }

    // If device auth, verify device is in the same organization
    if (device && device.organizationId !== organization_id) {
      return NextResponse.json({ error: 'Organization mismatch' }, { status: 403 });
    }

    // Check if this UID is already registered to someone else
    const { data: existingByUid } = await admin
      .from('rfid_cards')
      .select('id, member_id, status')
      .eq('rfid_uid', normalizedUid)
      .maybeSingle();

    if (existingByUid && existingByUid.member_id !== member_id && existingByUid.status === 'ACTIVE') {
      return NextResponse.json({
        error: 'This RFID card is already registered to another member',
        existing_member_id: existingByUid.member_id,
      }, { status: 409 });
    }

    // Revoke any existing card for this member (replace flow)
    await admin
      .from('rfid_cards')
      .update({ status: 'REVOKED', updated_at: new Date().toISOString() })
      .eq('member_id', member_id)
      .eq('status', 'ACTIVE');

    // Also revoke the UID if it was previously used by someone else
    if (existingByUid && existingByUid.status !== 'ACTIVE') {
      await admin
        .from('rfid_cards')
        .delete()
        .eq('id', existingByUid.id);
    }

    // Insert the new card
    const { data: card, error: insertErr } = await admin
      .from('rfid_cards')
      .insert({
        organization_id,
        institution_id: institution_id || member.institution_id || null,
        member_id,
        rfid_uid: normalizedUid,
        status: 'ACTIVE',
        registered_by: registeredBy,
        registered_at: new Date().toISOString(),
      })
      .select('id, rfid_uid, registered_at')
      .single();

    if (insertErr) {
      console.error('RFID register error:', insertErr);
      return NextResponse.json({ error: 'Failed to register RFID card' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'RFID card registered successfully',
      card: {
        id: card.id,
        rfid_uid: card.rfid_uid,
        member_id,
        role: member.role,
        registered_at: card.registered_at,
      },
    }, { status: 201 });

  } catch (err: any) {
    console.error('RFID registration error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
