import { createHash, timingSafeEqual } from 'node:crypto';

export function hashCardCredential(credential: string): string {
  return createHash('sha256').update(credential).digest('hex');
}

export function verifyCardCredential(credential: unknown, expectedHash: string | null): boolean {
  if (!expectedHash) return true;
  if (typeof credential !== 'string' || !credential.startsWith('CS1:')) return false;
  const supplied = Buffer.from(hashCardCredential(credential), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
