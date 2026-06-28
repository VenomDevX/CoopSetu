import { describe, it, expect } from 'vitest';
import { sourceHref, AI_SOURCE_ROUTES } from '@/lib/ai/source-href';

const ID = '11111111-1111-1111-1111-111111111111';

describe('AI citation sourceHref', () => {
  it('maps every supported source type to its real detail route', () => {
    expect(sourceHref({ source_type: 'task', source_id: ID })).toBe(`/dashboard/tasks/${ID}`);
    expect(sourceHref({ source_type: 'project', source_id: ID })).toBe(`/dashboard/projects/${ID}`);
    expect(sourceHref({ source_type: 'incident', source_id: ID })).toBe(`/dashboard/incidents/${ID}`);
    expect(sourceHref({ source_type: 'bug', source_id: ID })).toBe(`/dashboard/qa-security/bugs/${ID}`);
    expect(sourceHref({ source_type: 'security_review', source_id: ID })).toBe(`/dashboard/qa-security/security-reviews/${ID}`);
    expect(sourceHref({ source_type: 'release', source_id: ID })).toBe(`/dashboard/releases/${ID}`);
    expect(sourceHref({ source_type: 'approval_request', source_id: ID })).toBe(`/dashboard/approvals/${ID}`);
  });

  it('makes bug, security review, release, and approval citations clickable', () => {
    for (const t of ['bug', 'security_review', 'release', 'approval_request']) {
      expect(sourceHref({ source_type: t, source_id: ID })).not.toBeNull();
    }
  });

  it('covers exactly the seven AI source types the service can emit', () => {
    expect(Object.keys(AI_SOURCE_ROUTES).sort()).toEqual(
      ['approval_request', 'bug', 'incident', 'project', 'release', 'security_review', 'task'],
    );
  });

  it('never links to a nonexistent destination (no id or unknown type → null)', () => {
    expect(sourceHref({ source_type: 'task' })).toBeNull();
    expect(sourceHref({ source_type: 'task', source_id: null })).toBeNull();
    expect(sourceHref({ source_type: 'mystery', source_id: ID })).toBeNull();
  });
});
