import { describe, it, expect } from 'vitest';
import { isIpAllowed } from '@/lib/security/ip-utils';

describe('IP Utilities', () => {
  it('allows access if allowlist is empty or null', () => {
    expect(isIpAllowed('192.168.1.1', [])).toBe(true);
    expect(isIpAllowed('192.168.1.1', null)).toBe(true);
    expect(isIpAllowed('192.168.1.1', undefined)).toBe(true);
  });

  it('matches exact IPv4 addresses', () => {
    const allowlist = ['10.0.0.1', '192.168.1.5'];
    expect(isIpAllowed('10.0.0.1', allowlist)).toBe(true);
    expect(isIpAllowed('192.168.1.5', allowlist)).toBe(true);
    expect(isIpAllowed('192.168.1.100', allowlist)).toBe(false);
  });

  it('matches IPv4 CIDR blocks', () => {
    const allowlist = ['10.0.0.0/24'];
    expect(isIpAllowed('10.0.0.5', allowlist)).toBe(true);
    expect(isIpAllowed('10.0.0.255', allowlist)).toBe(true);
    expect(isIpAllowed('10.0.1.1', allowlist)).toBe(false);
  });

  it('matches exact IPv6 addresses', () => {
    const allowlist = ['2001:db8::1'];
    expect(isIpAllowed('2001:db8::1', allowlist)).toBe(true);
    expect(isIpAllowed('2001:db8::2', allowlist)).toBe(false);
  });

  it('matches IPv6 CIDR blocks', () => {
    const allowlist = ['2001:db8::/32'];
    expect(isIpAllowed('2001:db8::1', allowlist)).toBe(true);
    expect(isIpAllowed('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff', allowlist)).toBe(true);
    expect(isIpAllowed('2001:db9::1', allowlist)).toBe(false);
  });

  it('handles IPv4-mapped IPv6 addresses gracefully', () => {
    const allowlist = ['192.168.1.1'];
    expect(isIpAllowed('::ffff:192.168.1.1', allowlist)).toBe(true);
    expect(isIpAllowed('::ffff:192.168.1.2', allowlist)).toBe(false);
  });

  it('blocks unparseable IP addresses if allowlist is active', () => {
    const allowlist = ['10.0.0.1'];
    expect(isIpAllowed('not-an-ip', allowlist)).toBe(false);
    expect(isIpAllowed('', allowlist)).toBe(false);
  });

  it('ignores invalid entries in the allowlist', () => {
    const allowlist = ['invalid-entry', '10.0.0.1'];
    expect(isIpAllowed('10.0.0.1', allowlist)).toBe(true);
    expect(isIpAllowed('10.0.0.2', allowlist)).toBe(false);
  });
});
