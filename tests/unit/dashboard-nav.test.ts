import { describe, it, expect } from 'vitest';
import {
  buildNavGroups,
  resolveMobileTabs,
  MOBILE_TAB_COUNT,
  type NavGroup,
} from '@/lib/navigation/dashboard-nav';
import type { DashboardPersona } from '@/lib/auth/dashboard-persona';

// next-intl's useTranslations('Nav') is passed in as a plain lookup, so a stub
// that echoes the key is enough — and makes assertions readable.
const t = (key: string) => key;

const ALL_PERSONAS: DashboardPersona[] = [
  'ADMIN', 'INSTITUTE_ADMIN', 'PROJECT_MANAGER', 'TEAM_MANAGER',
  'TRAINER', 'TRAINEE', 'EMPLOYER', 'EMPLOYEE',
];

const hrefsOf = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));

describe('buildNavGroups', () => {
  it('gives ADMIN every group and every item', () => {
    const groups = buildNavGroups(t, 'ADMIN');
    expect(groups.map((g) => g.title)).toEqual([
      'Main_SYS', 'OPS_MGT', 'ENG_CORE', 'DATA_KNOWLEDGE',
      'Training_ERP', 'Learning_LMS', 'Employment', 'Cooperative_AI', 'Admin_Level',
    ]);
    // ADMIN bypasses the role filter entirely, so nothing is dropped.
    expect(hrefsOf(groups)).toContain('/dashboard/projects');
    expect(hrefsOf(groups)).toContain('/dashboard/id-card');
    expect(hrefsOf(groups)).toContain('/dashboard/teams');
  });

  it('gives TRAINEE only their own items plus the unrestricted ones', () => {
    const hrefs = hrefsOf(buildNavGroups(t, 'TRAINEE'));

    // Unrestricted (no `roles` key) — everyone sees these.
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/dashboard/my-work');
    expect(hrefs).toContain('/dashboard/attendance/me');
    expect(hrefs).toContain('/dashboard/career-ai');
    // Explicitly tagged TRAINEE.
    expect(hrefs).toContain('/dashboard/attendance');
    expect(hrefs).toContain('/dashboard/courses');
    expect(hrefs).toContain('/dashboard/id-card');
    // Not tagged for TRAINEE — must not leak into the nav.
    expect(hrefs).not.toContain('/dashboard/projects');
    expect(hrefs).not.toContain('/dashboard/trainees');
    expect(hrefs).not.toContain('/dashboard/teams');
    expect(hrefs).not.toContain('/dashboard/settings');
  });

  it('drops groups that end up empty rather than rendering a bare heading', () => {
    const titles = buildNavGroups(t, 'TRAINEE').map((g) => g.title);
    // Every item in these is ADMIN-only.
    expect(titles).not.toContain('OPS_MGT');
    expect(titles).not.toContain('ENG_CORE');
    // TRAINEE has no DATA_KNOWLEDGE items either.
    expect(titles).not.toContain('DATA_KNOWLEDGE');
    expect(titles).toContain('Learning_LMS');
  });

  it('scopes the other training personas correctly', () => {
    const trainer = hrefsOf(buildNavGroups(t, 'TRAINER'));
    expect(trainer).toContain('/dashboard/batches');
    expect(trainer).toContain('/dashboard/assessments');
    expect(trainer).not.toContain('/dashboard/id-card'); // TRAINEE-only
    expect(trainer).not.toContain('/dashboard/institutions');

    const employer = hrefsOf(buildNavGroups(t, 'EMPLOYER'));
    expect(employer).toContain('/dashboard/jobs');
    expect(employer).toContain('/dashboard/applications');
    expect(employer).toContain('/dashboard/skill-passport');
    expect(employer).not.toContain('/dashboard/trainees');

    const institute = hrefsOf(buildNavGroups(t, 'INSTITUTE_ADMIN'));
    expect(institute).toContain('/dashboard/trainees');
    expect(institute).toContain('/dashboard/analytics');
    expect(institute).not.toContain('/dashboard/projects'); // ADMIN-only
  });

  it('leaves the personas the nav never names with just the unrestricted items', () => {
    // resolveDashboardPersona returns eight personas but the nav's `roles`
    // arrays only ever mention five. This pins the resulting behaviour so it
    // is a deliberate outcome rather than an accident.
    for (const persona of ['PROJECT_MANAGER', 'TEAM_MANAGER', 'EMPLOYEE'] as DashboardPersona[]) {
      const hrefs = hrefsOf(buildNavGroups(t, persona));
      expect(hrefs).toEqual([
        '/dashboard', '/dashboard/my-work', '/dashboard/attendance/me', '/dashboard/inbox',
        '/dashboard/calendar', '/dashboard/career-ai',
      ]);
    }
  });

  it('translates item labels through the supplied lookup', () => {
    const overview = buildNavGroups((k) => `T:${k}`, 'TRAINEE')[0].items[0];
    expect(overview.name).toBe('T:overview');
    // Group titles are deliberately NOT translated — they're styled system
    // labels, matching the comment in the source.
    expect(buildNavGroups(t, 'TRAINEE')[0].title).toBe('Main_SYS');
  });
});

describe('resolveMobileTabs', () => {
  it.each(ALL_PERSONAS)('never offers %s a tab they cannot reach', (persona) => {
    const groups = buildNavGroups(t, persona);
    const reachable = new Set(hrefsOf(groups));
    const tabs = resolveMobileTabs(groups, persona);

    // The invariant that matters: a tab bar pointing at a route the persona's
    // own nav filtered out would be a dead end.
    for (const tab of tabs) expect(reachable.has(tab.href)).toBe(true);

    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.length).toBeLessThanOrEqual(MOBILE_TAB_COUNT);
    // No duplicate destinations in the bar.
    expect(new Set(tabs.map((tb) => tb.href)).size).toBe(tabs.length);
  });

  it('uses the persona-preferred destinations when they resolve', () => {
    const trainee = resolveMobileTabs(buildNavGroups(t, 'TRAINEE'), 'TRAINEE');
    expect(trainee.map((i) => i.href)).toEqual([
      '/dashboard', '/dashboard/my-learning', '/dashboard/courses', '/dashboard/attendance',
    ]);

    const employer = resolveMobileTabs(buildNavGroups(t, 'EMPLOYER'), 'EMPLOYER');
    expect(employer.map((i) => i.href)).toEqual([
      '/dashboard', '/dashboard/jobs', '/dashboard/applications', '/dashboard/skill-passport',
    ]);
  });

  it('always leads with the dashboard root', () => {
    for (const persona of ALL_PERSONAS) {
      const tabs = resolveMobileTabs(buildNavGroups(t, persona), persona);
      expect(tabs[0].href).toBe('/dashboard');
    }
  });

  it('backfills from what the persona can see when preferences do not resolve', () => {
    // A persona whose preferences point at filtered-out routes should still
    // get a full, usable bar rather than a stub.
    const groups = buildNavGroups(t, 'TRAINEE');
    const tabs = resolveMobileTabs(groups, 'ADMIN'); // ADMIN prefs vs TRAINEE nav
    expect(tabs.length).toBe(MOBILE_TAB_COUNT);
    const reachable = new Set(hrefsOf(groups));
    for (const tab of tabs) expect(reachable.has(tab.href)).toBe(true);
  });
});
