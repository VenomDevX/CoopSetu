import { test, expect } from '@playwright/test';

/**
 * Lean PR-time smoke suite — the 7 critical journeys, kept deliberately small
 * and fast so it can run on every push/PR alongside the integration suite.
 * The full onboarding/student-team/responsive specs (run nightly) cover the
 * exhaustive matrix; this file only proves the golden paths aren't broken.
 */

test.describe('Smoke: critical journeys', () => {
  test('1. Sign in lands on the dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/owner.json' });
    const page = await ctx.newPage();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await ctx.close();
  });

  test('2. Signup + onboarding reaches the profile step', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    const email = `smoke-signup-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.fill('input[type="text"]', 'Smoke Signup');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!@#');
    await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await page.click('button[role="checkbox"]');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/onboarding/profile', { timeout: 15000 });
    await expect(page.locator('text=Professional Identity').first()).toBeVisible();
    await ctx.close();
  });

  test('3. Student solo workspace creation reaches the dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    const email = `smoke-solo-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.fill('input[type="text"]', 'Smoke Solo');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!@#');
    await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await page.click('button[role="checkbox"]');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/onboarding/profile', { timeout: 15000 });

    await page.request.post('/api/v1/onboarding/profile', {
      data: {
        fullName: 'Smoke Solo', username: `smokesolo${Date.now()}`,
        jobFamily: 'Engineering', jobTitle: 'Software Engineer', specialization: 'Backend',
      },
    });

    const res = await page.request.post('/api/v1/student-workspaces/solo', { data: { name: `Smoke Solo Workspace ${Date.now()}` } });
    expect(res.ok()).toBeTruthy();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await ctx.close();
  });

  test('4. Student team creation returns a usable join code', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    const email = `smoke-team-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.fill('input[type="text"]', 'Smoke Lead');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!@#');
    await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await page.click('button[role="checkbox"]');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/onboarding/profile', { timeout: 15000 });

    await page.request.post('/api/v1/onboarding/profile', {
      data: {
        fullName: 'Smoke Lead', username: `smokelead${Date.now()}`,
        jobFamily: 'Engineering', jobTitle: 'Software Engineer', specialization: 'Backend',
      },
    });

    const res = await page.request.post('/api/v1/student-teams', { data: { name: `Smoke Team ${Date.now()}`, maxTeamSize: 5 } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.joinCode).toMatch(/^TEAM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    await ctx.close();
  });

  test('5. Joining a team with a valid code succeeds', async ({ browser }) => {
    const leadCtx = await browser.newContext({ storageState: undefined });
    const leadPage = await leadCtx.newPage();
    const leadEmail = `smoke-join-lead-${Date.now()}@example.com`;
    await leadPage.goto('/signup');
    await leadPage.fill('input[type="text"]', 'Smoke Join Lead');
    await leadPage.fill('input[type="email"]', leadEmail);
    await leadPage.fill('input[type="password"]', 'Password123!@#');
    await leadPage.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await leadPage.click('button[role="checkbox"]');
    await leadPage.click('button:has-text("Continue")');
    await leadPage.waitForURL('**/onboarding/profile', { timeout: 15000 });
    await leadPage.request.post('/api/v1/onboarding/profile', {
      data: {
        fullName: 'Smoke Join Lead', username: `smokejoinlead${Date.now()}`,
        jobFamily: 'Engineering', jobTitle: 'Software Engineer', specialization: 'Backend',
      },
    });
    const teamRes = await leadPage.request.post('/api/v1/student-teams', { data: { name: `Smoke Join Team ${Date.now()}`, maxTeamSize: 5 } });
    const { joinCode } = (await teamRes.json()).data;

    const joinerCtx = await browser.newContext({ storageState: undefined });
    const joinerPage = await joinerCtx.newPage();
    const joinerEmail = `smoke-joiner-${Date.now()}@example.com`;
    await joinerPage.goto('/signup');
    await joinerPage.fill('input[type="text"]', 'Smoke Joiner');
    await joinerPage.fill('input[type="email"]', joinerEmail);
    await joinerPage.fill('input[type="password"]', 'Password123!@#');
    await joinerPage.locator('input[type="password"]').nth(1).fill('Password123!@#');
    await joinerPage.click('button[role="checkbox"]');
    await joinerPage.click('button:has-text("Continue")');
    await joinerPage.waitForURL('**/onboarding/profile', { timeout: 15000 });
    await joinerPage.request.post('/api/v1/onboarding/profile', {
      data: {
        fullName: 'Smoke Joiner', username: `smokejoiner${Date.now()}`,
        jobFamily: 'Engineering', jobTitle: 'Software Engineer', specialization: 'Backend',
      },
    });

    const joinRes = await joinerPage.request.post('/api/v1/join-team', { data: { code: joinCode } });
    expect(joinRes.ok()).toBeTruthy();

    await leadCtx.close();
    await joinerCtx.close();
  });

  test('6. Task visibility respects role (PM sees tasks, an org-less outsider does not)', async ({ browser }) => {
    const pmCtx = await browser.newContext({ storageState: 'tests/e2e/.auth/pm.json' });
    const pmPage = await pmCtx.newPage();
    const res = await pmPage.request.get('/api/v1/tasks');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    await pmCtx.close();

    const outsiderCtx = await browser.newContext({ storageState: undefined });
    const outsiderPage = await outsiderCtx.newPage();
    await outsiderPage.goto('/dashboard/tasks');
    // No session at all — middleware must redirect to login rather than leaking the board.
    await outsiderPage.waitForURL(/login/, { timeout: 10000 });
    await outsiderCtx.close();
  });

  test('7. Mobile viewport smoke check on the dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/owner.json' });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noHorizontalScroll).toBe(true);
    await ctx.close();
  });
});
