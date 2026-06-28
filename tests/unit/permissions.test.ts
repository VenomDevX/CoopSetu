import { describe, it, expect } from 'vitest';
import { requirePermission } from '@/lib/auth/require-organization';
import type { Membership } from '@/lib/auth/get-current-membership';
import { ApiError } from '@/lib/api/errors';

function member(roles: string[], permissions: string[]): Membership {
  return { memberId: 'm1', organizationId: 'o1', roles, permissions };
}

describe('requirePermission', () => {
  it('allows when permission is present', () => {
    expect(() => requirePermission(member([], ['task:create']), 'task:create')).not.toThrow();
  });

  it('allows ORG_ADMIN regardless of explicit permissions', () => {
    expect(() => requirePermission(member(['ORG_ADMIN'], []), 'release:deploy')).not.toThrow();
  });

  it('allows SUPER_ADMIN regardless of explicit permissions', () => {
    expect(() => requirePermission(member(['SUPER_ADMIN'], []), 'security:approve')).not.toThrow();
  });

  it('throws FORBIDDEN when permission missing and not admin', () => {
    try {
      requirePermission(member(['DEVELOPER'], ['task:view']), 'task:create');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('FORBIDDEN');
      expect((e as ApiError).status).toBe(403);
    }
  });
});
