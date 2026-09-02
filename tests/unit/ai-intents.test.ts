import { describe, it, expect } from 'vitest';
import { getIntent, ALL_INTENTS, systemFor } from '@/lib/ai/intents';
import { checkIntentPermissions } from '@/lib/ai/ai-permission-checks';
import { streamGemini, isAiConfigured } from '@/lib/ai/gemini-provider';
import type { Membership } from '@/lib/auth/get-current-membership';

const member = (permissions: string[], roles: string[] = []): Membership => ({
  memberId: 'm1',
  organizationId: 'org1',
  roles,
  permissions,
});

describe('AI intent registry', () => {
  it('exposes every expected intent with a build fn and persona', () => {
    for (const intent of [
      'ask', 'daily-brief', 'my-focus', 'qa-security', 'release-readiness',
      'exec-briefing', 'summarize-project', 'summarize-sprint', 'summarize-task',
      'summarize-comments', 'summarize-incident', 'summarize-release', 'summarize-qa', 'task-plan',
    ]) {
      const def = getIntent(intent);
      expect(def, intent).toBeTruthy();
      expect(typeof def!.build).toBe('function');
      expect(systemFor(def!)).toMatch(/Handoff AI/);
      // Grounding rule is always present in the system instruction.
      expect(systemFor(def!)).toMatch(/ONLY using the FACTS/);
    }
    expect(ALL_INTENTS.length).toBeGreaterThanOrEqual(14);
  });

  it('returns undefined for an unknown intent', () => {
    expect(getIntent('does-not-exist')).toBeUndefined();
  });
});

describe('AI permission gating', () => {
  it('requires ai:use for every intent', () => {
    expect(() => checkIntentPermissions(member([]), [])).toThrow(); // no ai:use
    expect(() => checkIntentPermissions(member(['ai:use']), [])).not.toThrow();
  });

  it('requires at least one feature permission when the intent declares them', () => {
    const def = getIntent('qa-security')!;
    expect(() => checkIntentPermissions(member(['ai:use']), def.permissions)).toThrow();
    expect(() => checkIntentPermissions(member(['ai:use', 'qa:view']), def.permissions)).not.toThrow();
    expect(() => checkIntentPermissions(member(['ai:use', 'security:view']), def.permissions)).not.toThrow();
  });

  it('org admins implicitly pass feature checks but still need ai:use indirectly granted', () => {
    // ORG_ADMIN holds all permissions including ai:use via hasPermission.
    expect(() => checkIntentPermissions(member([], ['ORG_ADMIN']), ['analytics:view'])).not.toThrow();
  });
});

describe('Gemini provider — missing API key', () => {
  it('reports not configured and throws a 503 ApiError when GEMINI_API_KEY is unset', async () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(isAiConfigured()).toBe(false);
      const gen = streamGemini({ system: 's', prompt: 'p' });
      await expect(gen.next()).rejects.toMatchObject({ status: 503 });
    } finally {
      if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
    }
  });
});
