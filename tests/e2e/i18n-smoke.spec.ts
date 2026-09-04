import { test, expect, type Browser } from '@playwright/test';

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

/**
 * Phase 9 (i18n infrastructure): the language switcher must toggle the
 * locale (and <html lang>) without breaking navigation or auth-guarded
 * redirects — the plan's own stated highest regression risk for this phase.
 * hi.json is currently an English-content placeholder (see
 * messages/README.md) pending Phase 10's real translations, so this test
 * verifies the *mechanism* (locale switches, page keeps working) rather
 * than asserting specific Hindi text that doesn't exist yet.
 */
test.describe('i18n smoke', () => {
  test('switching locale on the public login page does not break the login flow', async ({ browser }) => {
    const anonCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await anonCtx.newPage();
    await page.goto('/login');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    // Still English text today — hi.json is a placeholder copy, not yet translated.
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // The auth-guarded flow itself must still work after switching locale —
    // this plan's own stated highest regression risk for this phase.
    await page.locator('input[type="text"]').first().fill('trainee@coopsetu.test');
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD ?? '');
    await page.getByRole('button', { name: /^Sign In$/ }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await anonCtx.close();
  });

  test('switching locale in the dashboard does not break client-side navigation', async ({ browser }) => {
    const traineeCtx = await ctx(browser, 'trainee');
    const page = await traineeCtx.newPage();
    await page.goto('/dashboard');
    await expect(page.getByText('Overview')).toBeVisible();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // Nav still renders and is still navigable after the locale switch.
    await expect(page.getByText('Career AI')).toBeVisible();
    await page.getByRole('link', { name: 'Jobs' }).click();
    await expect(page).toHaveURL(/\/dashboard\/jobs/);
    await expect(page.getByText('Employment Exchange')).toBeVisible();

    await traineeCtx.close();
  });
});
