import { test, expect } from '@playwright/test';

// The native project sets no storageState; specs opt in, as the other native
// specs do.
test.use({ storageState: 'tests/e2e/.auth/trainee.json' });

test.describe('lesson player', () => {
  test.beforeEach(async ({ page }) => {
    // Next's dev overlay swallows clicks in this viewport; absent in prod builds.
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });

  test('plays a course and records progress', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/dashboard/courses');
    const link = page.locator('a[href*="/learn"]').first();
    await link.waitFor({ state: 'visible', timeout: 60_000 });
    await link.click();

    // The module list is the page's spine — wait on it rather than a timeout,
    // because a cold dev compile can take tens of seconds.
    const modules = page.locator('aside button');
    await expect(modules.first()).toBeVisible({ timeout: 60_000 });
    expect(await modules.count()).toBeGreaterThan(1);

    // A video module must produce a real <video>. Before this feature existed
    // there was no media element anywhere in the app.
    await expect(page.locator('video')).toHaveCount(1);

    // Selecting a text module swaps the player for the authored lesson body.
    await modules.nth(1).click();
    await expect(page.getByText(/autonomous association|VOLUNTARY AND OPEN MEMBERSHIP/)).toBeVisible({
      timeout: 20_000,
    });

    // Scrolling a text lesson to the end marks it complete, which the sidebar
    // reflects without a reload.
    const body = page.locator('aside').locator('..').locator('div[class*="overflow-y-auto"]').last();
    await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByText(/1 \/ \d+ complete/i)).toBeVisible({ timeout: 20_000 });
  });
});
