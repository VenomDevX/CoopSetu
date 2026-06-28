import { describe, it, expect, vi } from 'vitest';
import { isReservedUsername, isReservedWorkspaceSlug } from '@/lib/auth/reserved-identifiers';

describe('Auth Validation - Reserved Identifiers', () => {
  it('rejects reserved workspace slugs', () => {
    expect(isReservedWorkspaceSlug('admin')).toBe(true);
    expect(isReservedWorkspaceSlug('api')).toBe(true);
    expect(isReservedWorkspaceSlug('handoff-support')).toBe(true);
    expect(isReservedWorkspaceSlug('  Admin  ')).toBe(true); // check normalization
  });

  it('allows normal workspace slugs', () => {
    expect(isReservedWorkspaceSlug('my-company')).toBe(false);
    expect(isReservedWorkspaceSlug('apex-financial')).toBe(false);
    expect(isReservedWorkspaceSlug('engineering-team')).toBe(false);
  });

  it('rejects reserved usernames', () => {
    expect(isReservedUsername('admin')).toBe(true);
    expect(isReservedUsername('system')).toBe(true);
    expect(isReservedUsername('official')).toBe(true);
    expect(isReservedUsername('  SysTem ')).toBe(true); // check normalization
  });

  it('allows normal professional usernames', () => {
    expect(isReservedUsername('developer.parth')).toBe(false);
    expect(isReservedUsername('manager')).toBe(false);
    expect(isReservedUsername('projectmanager')).toBe(false);
    expect(isReservedUsername('designer.123')).toBe(false);
  });
});
