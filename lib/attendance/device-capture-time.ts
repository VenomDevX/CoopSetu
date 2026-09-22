const MAX_OFFLINE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export class InvalidCaptureTimeError extends Error {}

/** Accept device timestamps only inside a bounded replay window. */
export function parseDeviceCaptureTime(value: unknown, now = new Date()): Date {
  if (value === undefined || value === null || value === '') return now;
  if (typeof value !== 'string') throw new InvalidCaptureTimeError('captured_at must be an ISO timestamp');

  const captured = new Date(value);
  if (!Number.isFinite(captured.getTime())) throw new InvalidCaptureTimeError('captured_at is invalid');
  const age = now.getTime() - captured.getTime();
  if (age > MAX_OFFLINE_AGE_MS) throw new InvalidCaptureTimeError('Offline event is older than 7 days');
  if (age < -MAX_FUTURE_SKEW_MS) throw new InvalidCaptureTimeError('Device clock is too far ahead');
  return captured;
}

export function canDeviceAccessInstitution(
  deviceInstitutionId: string | null,
  memberInstitutionId: string | null,
): boolean {
  return !deviceInstitutionId || !memberInstitutionId || deviceInstitutionId === memberInstitutionId;
}
