import { encrypt, decrypt } from '@/lib/security/encryption';

/**
 * Every integration provider's OAuth tokens/secrets must go through this pair
 * before touching `integrations.encrypted_secrets`, so adding a new provider
 * never risks landing a plaintext secret in the DB by accident.
 */
export function encryptIntegrationSecrets(payload: Record<string, unknown>): string {
  return encrypt(JSON.stringify(payload));
}

export function decryptIntegrationSecrets<T = Record<string, unknown>>(encryptedPayload: string): T {
  return JSON.parse(decrypt(encryptedPayload)) as T;
}
