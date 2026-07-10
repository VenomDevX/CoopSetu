import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { encryptIntegrationSecrets, decryptIntegrationSecrets } from '@/lib/integrations/encrypt-secrets';

describe('encryptIntegrationSecrets / decryptIntegrationSecrets', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('round-trips an arbitrary secrets object', () => {
    const payload = { access_token: 'gho_abc123', refresh_token: 'ghr_def456' };
    const encrypted = encryptIntegrationSecrets(payload);
    expect(encrypted).not.toContain('gho_abc123');
    expect(decryptIntegrationSecrets(encrypted)).toEqual(payload);
  });

  it('produces different ciphertext for the same payload each call (random IV)', () => {
    const payload = { access_token: 'same-token' };
    expect(encryptIntegrationSecrets(payload)).not.toBe(encryptIntegrationSecrets(payload));
  });
});
