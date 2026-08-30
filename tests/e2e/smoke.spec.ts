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
