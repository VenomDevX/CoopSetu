import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Fast account setup: real UI signup (proven flow from onboarding.spec.ts)
 * followed by direct authenticated API calls for the steps whose UI isn't
 * what these tests are actually verifying (profile completion, workspace/team
 * creation). Session cookies are shared automatically between `page` and
 * `page.request`, exactly like the pattern in tests/e2e/auth.setup.ts.
 */
async function signUpAndCompleteProfile(page: Page, namePrefix: string) {
  const email = `${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

  await page.goto('/signup');
  await page.fill('input[type="text"]', namePrefix);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'Password123!@#');
  await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
  await page.click('button[role="checkbox"]');
  await page.click('button:has-text("Continue")');
  await page.waitForURL('**/onboarding/profile', { timeout: 15000 });

  const res = await page.request.post('/api/v1/onboarding/profile', {
    data: {
      fullName: namePrefix,
      username: `${namePrefix.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now()}`,
      jobFamily: 'Engineering',
      jobTitle: 'Software Engineer',
      specialization: 'Backend',
    },
  });
  expect(res.ok()).toBeTruthy();
  return email;
}

async function createSoloWorkspace(page: Page, name: string) {
  const res = await page.request.post('/api/v1/student-workspaces/solo', { data: { name } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data as { organizationId: string };
}

async function createStudentTeam(page: Page, name: string, maxTeamSize = 5) {
  const res = await page.request.post('/api/v1/student-teams', { data: { name, maxTeamSize } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data as { organizationId: string; joinCode: string };
}

async function joinTeam(page: Page, code: string) {
  const res = await page.request.post('/api/v1/join-team', { data: { code } });
  expect(res.ok()).toBeTruthy();
}

async function newStudentSession(context: BrowserContext, namePrefix: string) {
  const page = await context.newPage();
  const email = await signUpAndCompleteProfile(page, namePrefix);
  return { page, email };
}

test.describe('Student Team dashboard', () => {
  test('Team Lead sees Join Code Management and can rotate/revoke the code', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const { page } = await newStudentSession(ctx, 'TeamLead');
    await createStudentTeam(page, `Lead Squad ${Date.now()}`);

    await page.goto('/dashboard/teams');
    await expect(page.locator('text=Join Code Management')).toBeVisible();
    await expect(page.locator('button:has-text("Rotate Code")')).toBeVisible();
    await expect(page.locator('button:has-text("Revoke")')).toBeVisible();
    await expect(page.locator('text=Team Settings')).toBeVisible();

    // Rotating reveals the new raw code once (replacing the "Active code —
    // used N times" summary with a copy-once view) — assert on that, not the
    // pre-rotate summary text.
    await page.getByRole('button', { name: 'Rotate Code' }).click();
    await expect(page.getByRole('button', { name: /^Copy$/ })).toBeVisible({ timeout: 15000 });

    const [revokeRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/join-code') && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'Revoke' }).click(),
    ]);
    expect(revokeRes.ok()).toBeTruthy();
    // rotateCode()'s own reload can race revoke's reload and briefly leave the
    // client showing stale "still active" data — reload for a clean read of
    // the actual server state rather than asserting against that race.
    await page.reload();
    await expect(page.locator('text=No active join code')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(0);

    await ctx.close();
  });

  test('a regular Member sees a read-only team view (no rotate/revoke/settings)', async ({ browser }) => {
    const leadCtx = await browser.newContext({ storageState: undefined });
    const { page: leadPage } = await newStudentSession(leadCtx, 'ReadOnlyLead');
    const team = await createStudentTeam(leadPage, `ReadOnly Squad ${Date.now()}`);

    const memberCtx = await browser.newContext({ storageState: undefined });
    const { page: memberPage } = await newStudentSession(memberCtx, 'ReadOnlyMember');
    await joinTeam(memberPage, team.joinCode);

    await memberPage.goto('/dashboard/teams');
    await expect(memberPage.locator('text=Team Members')).toBeVisible();
    await expect(memberPage.locator('button:has-text("Rotate Code")')).toHaveCount(0);
    await expect(memberPage.locator('button:has-text("Revoke")')).toHaveCount(0);
    await expect(memberPage.locator('text=Team Settings')).toHaveCount(0);

    await leadCtx.close();
    await memberCtx.close();
  });
});

test.describe('STUDENT_SOLO workspace settings', () => {
  test('rename the workspace, then delete it with confirmation', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const { page } = await newStudentSession(ctx, 'SoloSettings');
    const originalName = `Solo Before ${Date.now()}`;
    await createSoloWorkspace(page, originalName);

    await page.goto('/dashboard/settings');
    await page.getByRole('button', { name: 'Workspace', exact: true }).click();

    const nameField = page.getByRole('textbox').first();
    await expect(nameField).toHaveValue(originalName);

    const renamed = `Solo After ${Date.now()}`;
    await nameField.fill(renamed);
    await page.click('button:has-text("Save Changes")');
    await expect(page.locator('text=Workspace updated successfully')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Delete")');
    await expect(page.getByRole('heading', { name: 'Delete Workspace' })).toBeVisible();
    await page.locator('input').last().fill(renamed);
    await page.getByRole('button', { name: 'Delete Workspace' }).click();
    await page.waitForURL('**/onboarding**', { timeout: 15000 });

    await ctx.close();
  });
});

test.describe('Student repository access', () => {
  test('a Team Lead can see Repositories in the nav and connect a repository', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const { page } = await newStudentSession(ctx, 'RepoLead');
    await createStudentTeam(page, `Repo Squad ${Date.now()}`);

    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Repositories' })).toBeVisible();

    await page.goto('/dashboard/repositories');
    await expect(page.getByRole('heading', { name: 'Engineering' })).toBeVisible();

    await page.getByRole('button', { name: 'Connect Repository' }).click();
    const repoName = `student-repo-${Date.now()}`;
    await page.getByPlaceholder('e.g., handoff-core').fill(repoName);
    const [connectRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/repositories') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Connect', exact: true }).click(),
    ]);
    expect(connectRes.ok()).toBeTruthy();

    await expect(page.locator(`text=${repoName}`)).toBeVisible({ timeout: 15000 });

    await ctx.close();
  });
});

test.describe('Command palette gating', () => {
  test('a student never sees enterprise-only nav items in ⌘K search results', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const { page } = await newStudentSession(ctx, 'PaletteStudent');
    await createSoloWorkspace(page, `Palette Solo ${Date.now()}`);

    await page.goto('/dashboard');
    await page.keyboard.press('Control+k');
    const searchInput = page.locator('input[placeholder*="Search pages"]');
    await expect(searchInput).toBeVisible();

    for (const term of ['Billing', 'Organization', 'Users & Roles', 'Audit']) {
      await searchInput.fill(term);
      await expect(page.locator('text=No matches')).toBeVisible();
    }

    await ctx.close();
  });
});
