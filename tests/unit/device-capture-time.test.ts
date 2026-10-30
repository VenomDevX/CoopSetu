import { describe, expect, it } from 'vitest';
import {
  canDeviceAccessInstitution,
  InvalidCaptureTimeError,
  parseDeviceCaptureTime,
} from '@/lib/attendance/device-capture-time';
import { hashCardCredential, verifyCardCredential } from '@/lib/attendance/rfid-credential';

describe('device capture time', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');

  it('preserves an offline capture timestamp', () => {
    expect(parseDeviceCaptureTime('2026-09-20T10:30:12.000Z', now).toISOString())
      .toBe('2026-09-20T10:30:12.000Z');
  });

  it('rejects stale and future device clocks', () => {
    expect(() => parseDeviceCaptureTime('2026-09-12T11:59:59.000Z', now))
      .toThrow(InvalidCaptureTimeError);
    expect(() => parseDeviceCaptureTime('2026-09-20T12:06:00.000Z', now))
      .toThrow(InvalidCaptureTimeError);
  });

  it('lets a national device reach anyone but pins an institution device to its own members', () => {
    expect(canDeviceAccessInstitution(null, 'lucknow')).toBe(true);
    expect(canDeviceAccessInstitution(null, null)).toBe(true);
    // National-scope member (no institution) is valid at any pinned terminal.
    expect(canDeviceAccessInstitution('lucknow', null)).toBe(true);
    expect(canDeviceAccessInstitution('lucknow', 'lucknow')).toBe(true);
    expect(canDeviceAccessInstitution('lucknow', 'bengaluru')).toBe(false);
  });
});

describe('RFID card credentials', () => {
  const credential = 'CS1:00112233445566778899AABBCCDDEEFF';
  const hash = hashCardCredential(credential);

  it('accepts the provisioned credential and rejects UID-only clones', () => {
    expect(verifyCardCredential(credential, hash)).toBe(true);
    expect(verifyCardCredential(undefined, hash)).toBe(false);
    expect(verifyCardCredential('CS1:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', hash)).toBe(false);
  });

  it('keeps legacy UID cards compatible during migration', () => {
    expect(verifyCardCredential(undefined, null)).toBe(true);
  });
});
