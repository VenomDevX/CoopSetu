import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevice } from '@/lib/auth/device-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { canDeviceAccessInstitution } from '@/lib/attendance/device-capture-time';

export async function POST(request: NextRequest) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (Number.isInteger(body.delete_slot)) {
    const slotToDelete = body.delete_slot as number;
    if (slotToDelete < 0 || slotToDelete > 255) {
      return NextResponse.json({ error: 'valid delete_slot is required' }, { status: 400 });
    }
    const admin = createAdminClient();
    let query = admin.from('face_slots').delete().eq('device_id', device.id);
    if (slotToDelete !== 255) query = query.eq('slot', slotToDelete);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  const slot = body.slot;
  const memberId = body.member_id;
  if (!Number.isInteger(slot) || slot < 0 || slot > 15 || typeof memberId !== 'string') {
    return NextResponse.json({ error: 'slot 0..15 and member_id are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member } = await admin.from('organization_members')
    .select('id, organization_id, institution_id, is_active')
    .eq('id', memberId).eq('organization_id', device.organizationId).maybeSingle();
  if (!member?.is_active || !canDeviceAccessInstitution(device.institutionId, member.institution_id)) {
    return NextResponse.json({ error: 'Member is outside this device scope' }, { status: 403 });
  }

  await admin.from('face_slots').delete().eq('device_id', device.id).eq('member_id', memberId).neq('slot', slot);
  const { data, error } = await admin.from('face_slots').upsert({
    device_id: device.id,
    slot,
    member_id: member.id,
    organization_id: member.organization_id,
    institution_id: member.institution_id,
  }, { onConflict: 'device_id,slot' }).select('id, slot, member_id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ success: true, face_slot: data });
}

export async function DELETE(request: NextRequest) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: 'Unauthorized device' }, { status: 401 });
  const slot = Number(new URL(request.url).searchParams.get('slot'));
  if (!Number.isInteger(slot) || slot < 0 || slot > 255) {
    return NextResponse.json({ error: 'valid slot is required' }, { status: 400 });
  }
  const admin = createAdminClient();
  let query = admin.from('face_slots').delete().eq('device_id', device.id);
  if (slot !== 255) query = query.eq('slot', slot);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
