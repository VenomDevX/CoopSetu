import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Bearer authentication for attendance hardware.
 *
 * A wall-mounted terminal has no cookie session, which is why
 * /api/v1/attendance/qr rejected the ESP32 firmware and why
 * /api/v1/hardware/scan ended up with no authentication at all. This gives both
 * a single credential check.
 *
 * The lookup runs through the service-role client on purpose: device_tokens has
 * no SELECT policy for anon or authenticated, so nothing can read token hashes
 * over PostgREST. Callers pass the resolved device to a service-role client
 * afterwards, so the device's own scope — not RLS — is what limits it.
 */

export interface DeviceIdentity {
  id: string;
  organizationId: string;
  institutionId: string | null;
  label: string;
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Resolves the Authorization header to a device, or null.
 *
 * Returns null rather than throwing for every failure mode — missing header,
 * wrong scheme, unknown token, revoked token — so a caller cannot accidentally
 * distinguish "no such device" from "revoked device" through timing or error
 * text. Both are simply unauthenticated.
 */
export async function authenticateDevice(request: Request): Promise<DeviceIdentity | null> {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;

  const token = match[1].trim();
  // A placeholder left in firmware/CoopSetuTerminal/config.h must never
  // authenticate, however the deployment is configured.
  if (!token || token === 'CHANGE_ME') return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('device_tokens')
    .select('id, organization_id, institution_id, label, revoked_at')
    .eq('token_hash', hashDeviceToken(token))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Best-effort liveness: an operator needs to see whether a terminal is still
  // checking in. Never allowed to fail the request it is attached to.
  void admin
    .from('device_tokens')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(undefined, () => {});

  return {
    id: data.id,
    organizationId: data.organization_id,
    institutionId: data.institution_id,
    label: data.label,
  };
}
