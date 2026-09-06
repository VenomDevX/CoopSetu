import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DEMO_ROLES, DEMO_PERSONAS } from '@/lib/demo/provision-demo-workspace';

/**
 * Regression guard for the bug that broke the nightly full-regression run every
 * night from 2026-08-31.
 *
 * provisionDemoWorkspace() only makes the visitor a member when their requested
 * role matches one of DEMO_PERSONAS. An unrecognised role left visitorMemberId
 * as '', which surfaced 200 lines later as
 *   "Failed to create demo session: invalid input syntax for type uuid"
 * — an error that says nothing about the actual mistake. The route's schema was
 * z.string(), so any typo reached that path.
 */
describe('demo role validation', () => {
  it('DEMO_ROLES matches the personas that actually get provisioned', () => {
    // If a persona is added without updating DEMO_ROLES, the route would reject
    // a role the provisioner can serve. If one is removed, the route would
    // accept a role that leaves visitorMemberId empty — the original bug.
    expect([...DEMO_ROLES].sort()).toEqual(DEMO_PERSONAS.map((p) => p.role).sort());
  });

  it('accepts every provisionable role', () => {
    const schema = z.object({ role: z.enum(DEMO_ROLES) }).strict();
    for (const role of DEMO_ROLES) {
      expect(schema.safeParse({ role }).success).toBe(true);
    }
  });

  it('rejects roles that exist in the wider RBAC but have no demo persona', () => {
    const schema = z.object({ role: z.enum(DEMO_ROLES) }).strict();
    // ADMIN and ORG_OWNER are real role codes elsewhere in the system, which is
    // exactly why this was easy to get wrong.
    for (const role of ['ADMIN', 'ORG_OWNER', 'PROJECT_MANAGER', 'EMPLOYEE', '']) {
      expect(schema.safeParse({ role }).success).toBe(false);
    }
  });
});
