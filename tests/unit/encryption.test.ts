import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { encrypt, decrypt } from '@/lib/security/encryption';

describe('Encryption Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Provide a valid 32-byte key for testing
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should encrypt and decrypt a plaintext string successfully', () => {
    const plaintext = JSON.stringify({ token: 'ghp_secret123', client_id: 'client_xyz' });
    const encrypted = encrypt(plaintext);
    
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':'); // Ensure it contains IV and AuthTag boundaries
    
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should generate different ciphertexts for the same plaintext due to random IV', () => {
    const plaintext = 'top_secret_data';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it('should throw an error if the environment variable is missing', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow(/FATAL: ENCRYPTION_KEY environment variable is not set/);
  });

  it('should throw an error if the key is not 32 bytes', () => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(16).toString('base64');
    expect(() => encrypt('test')).toThrow(/must be exactly 32 bytes/);
  });

  it('should fail to decrypt if the auth tag is tampered with', () => {
    const plaintext = 'sensitive_info';
    const encrypted = encrypt(plaintext);
    
    const parts = encrypted.split(':');
    // Tamper with auth tag
    parts[2] = Buffer.from('invalidtag123456').toString('base64');
    const tamperedPayload = parts.join(':');
    
    expect(() => decrypt(tamperedPayload)).toThrow(/Failed to decrypt sensitive data/);
  });

  it('should fail to decrypt if the ciphertext is tampered with', () => {
    const plaintext = 'sensitive_info';
    const encrypted = encrypt(plaintext);
    
    const parts = encrypted.split(':');
    parts[1] = Buffer.from('invalidciphertext').toString('base64');
    const tamperedPayload = parts.join(':');
    
    expect(() => decrypt(tamperedPayload)).toThrow(/Failed to decrypt sensitive data/);
  });
});
