import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { memberRoleCode } from '@/lib/auth/member-role';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';

/**
 * RFID lookup by UID.
 *
 * Returns the card's status and linked member info. Used by:
 *   - The web dashboard's RFID Registration page (pre-fill current status)
 *   - The terminal's admin flow (verify before re-registration)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    // Either device-auth or web session
    const device = await authenticateDevice(_request);
    if (!device) {
      const membership = await getCurrentMembership();
      if (!membership) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { uid } = await params;
    if (!uid) {
      return NextResponse.json({ error: 'UID parameter required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: card, error } = await admin
      .from('rfid_cards')
      .select(`
        id, rfid_uid, status, registered_at, updated_at,
        organization_id, institution_id, member_id,
        organization_members!inner (
          id, user_id, institution_id,
          member_roles!organization_member_id ( roles ( code ) ),
          profiles:user_id ( full_name )
        )
      `)
      .eq('rfid_uid', uid.toUpperCase().trim())
      .maybeSingle();

    if (error) {
      console.error('RFID lookup error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    if (!card) {
      return NextResponse.json({
        found: false,
        rfid_uid: uid.toUpperCase().trim(),
      }, { status: 404 });
    }

    const member = card.organization_members as any;

    return NextResponse.json({
      found: true,
      card: {
        id: card.id,
        rfid_uid: card.rfid_uid,
        status: card.status,
        registered_at: card.registered_at,
        updated_at: card.updated_at,
        member: {
          id: member.id,
          name: member.profiles?.full_name ?? 'Unknown',
          role: memberRoleCode(member),
          institution_id: member.institution_id,
        },
      },
    });

  } catch (err: any) {
    console.error('RFID lookup error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
