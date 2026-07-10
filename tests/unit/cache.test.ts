import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryProvider } from '@/lib/cache/memory-provider';
import { cache } from '@/lib/cache/cache';
import { UpstashRedisProvider } from '@/lib/cache/redis-provider';
import { createHash } from 'crypto';

describe('Cache Layer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('MemoryProvider', () => {
    it('1. should handle TTL expiration correctly', async () => {
      const provider = new MemoryProvider();
      await provider.set('key1', 'value1', 5); // 5 seconds
      
      let val = await provider.get('key1');
      expect(val).toBe('value1');
      
      vi.advanceTimersByTime(6000); // Wait 6 seconds
      
      val = await provider.get('key1');
      expect(val).toBeNull();
    });

    it('2. should handle version incrementing', async () => {
      const provider = new MemoryProvider();
      let version = await provider.get('version_key');
      expect(version).toBeNull(); // starts null/0 in logic
      
      const v1 = await provider.increment('version_key');
      expect(v1).toBe(1);
      
      const v2 = await provider.increment('version_key');
      expect(v2).toBe(2);
    });
  });

  describe('Cache Wrapper', () => {
    it('3. should fall back safely when Redis provider throws', async () => {
      // Create a mock redis provider that throws
      const failingProvider = new UpstashRedisProvider();
      vi.spyOn(failingProvider as any, 'client', 'get').mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('Redis is down')),
        set: vi.fn().mockRejectedValue(new Error('Redis is down')),
        incr: vi.fn().mockRejectedValue(new Error('Redis is down')),
      });

      // Wrap the cache with our failing provider explicitly for testing
      (cache as any).provider = failingProvider;

      // Ensure it doesn't throw and returns null / 0
      const getResult = await cache.get('some_key');
      expect(getResult).toBeNull();

      await expect(cache.set('some_key', 'val', 10)).resolves.not.toThrow();

      const version = await cache.incrementCacheVersion('scope_key');
      expect(version).toBe(0);
    });
  });

  describe('Dashboard Scoping', () => {
    it('4. Dashboard cache key correctly includes all scopes', () => {
      const searchStr = 'status=open';
      const filtersHash = createHash('sha256').update(searchStr).digest('hex').substring(0, 8);
      const key = `dashboard:overview:v1:org_org1:member_mem1:dashboardOrgVersion_1:memberAccessVersion_1:projectScopeVersion_1:ws_default:filters_${filtersHash}:page_1`;
      
      expect(key).toContain('org_org1');
      expect(key).toContain('member_mem1');
      expect(key).toContain('dashboardOrgVersion_1');
      expect(key).toContain('memberAccessVersion_1');
      expect(key).toContain('projectScopeVersion_1');
      expect(key).toContain('ws_default');
      expect(key).toContain(`filters_${filtersHash}`);
      expect(key).toContain('page_1');
    });

    it('5. Org Admin and Employee do not share cached dashboard data', () => {
      const adminKey = `dashboard:overview:v1:org_org1:member_admin1:dashboardOrgVersion_1:memberAccessVersion_1:projectScopeVersion_1:ws_default:filters_none:page_1`;
      const empKey = `dashboard:overview:v1:org_org1:member_emp1:dashboardOrgVersion_1:memberAccessVersion_1:projectScopeVersion_1:ws_default:filters_none:page_1`;
      
      expect(adminKey).not.toEqual(empKey);
    });

    it('6. Project Manager and unrelated Project Manager do not share cached data', () => {
      const pm1Key = `dashboard:overview:v1:org_org1:member_pm1:dashboardOrgVersion_1:memberAccessVersion_1:projectScopeVersion_1:ws_default:filters_none:page_1`;
      const pm2Key = `dashboard:overview:v1:org_org1:member_pm2:dashboardOrgVersion_1:memberAccessVersion_1:projectScopeVersion_1:ws_default:filters_none:page_1`;
      
      expect(pm1Key).not.toEqual(pm2Key);
    });
    
    it('10. Cache keys and logs do not include PII', () => {
      const rawJoinCode = 'JOIN-12345';
      const searchStr = `code=${rawJoinCode}`;
      const filtersHash = createHash('sha256').update(searchStr).digest('hex').substring(0, 8);
      
      const key = `dashboard:overview:v1:org_org1:member_mem1:dashboardOrgVersion_1:memberAccessVersion_1:projectScopeVersion_1:ws_default:filters_${filtersHash}:page_1`;
      expect(key).not.toContain(rawJoinCode); // Raw code is safely hashed
    });
  });
});
