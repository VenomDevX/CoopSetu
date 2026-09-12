import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes, createHash } from 'node:crypto';

/**
 * Device management — authenticated admin only.
 *
 * GET:  List all device tokens for the current organization
 * POST: Issue a new device token (shows plaintext once)
 */

export async function GET(_request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: devices, error } = await admin
      .from('device_tokens')
      .select(`
        id, label, device_name, location, status,
        token_hint, institution_id, last_seen_at, revoked_at, created_at,
        institutions:institution_id ( name )
      `)
      .eq('organization_id', membership.organizationId)
      .order('created_at', { ascending: false });

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
        token_hint: d.token_hint,
        institution: d.institutions?.name ?? null,
        institution_id: d.institution_id,
        last_seen_at: d.last_seen_at,
        revoked_at: d.revoked_at,
        created_at: d.created_at,
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

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { label, device_name, location, institution_id } = body;

    if (!label || typeof label !== 'string') {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    // Generate a secure token
    const plaintext = `cst_${randomBytes(24).toString('hex')}`;
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const tokenHint = plaintext.slice(-4);

    const admin = createAdminClient();

    const { data: device, error } = await admin
      .from('device_tokens')
      .insert({
        organization_id: membership.organizationId,
        institution_id: institution_id || null,
        label,
        device_name: device_name || null,
        location: location || null,
        token_hash: tokenHash,
        token_hint: tokenHint,
        created_by: auth.user.id,
        status: 'ACTIVE',
      })
      .select('id, label, token_hint, created_at')
      .single();

    if (error) {
      console.error('Device create error:', error);
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
        created_at: device.created_at,
      },
      token: plaintext,
    }, { status: 201 });

  } catch (err: any) {
    console.error('Device create error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
