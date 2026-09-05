import { test, expect, devices, type Browser } from '@playwright/test';

/**
 * The digital ID screen has one job in the app: be held up to a scanner at a
 * door. Measured on a Pixel 7 before the fix, the web layout needed 892px of
 * content in a 726px viewport, which pushed the rotating fallback code — what
 * a trainee reads out when the scan fails — off the bottom behind the tab bar.
 */
test.use({ storageState: 'tests/e2e/.auth/trainee.json' });

test.describe('native digital ID', () => {
  test('the whole card fits without scrolling', async ({ page }) => {
    await page.goto('/dashboard/id-card');
    await page.getByAltText('Live QR').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(500);

    const fits = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      return main.scrollHeight <= main.clientHeight + 1;
    });
    expect(fits, 'ID card should not require scrolling in the app').toBe(true);
  });

  test('the rotating fallback code is on screen, not below the fold', async ({ page }) => {
    await page.goto('/dashboard/id-card');
    await page.getByAltText('Live QR').waitFor({ timeout: 20_000 });

    const liveCode = page.getByText('Live Code');
    await expect(liveCode).toBeVisible();

    // Visible in the strict sense: inside the viewport, not merely present.
    const onScreen = await liveCode.evaluate((el) => {
      const code = el.nextElementSibling;
      if (!code) return false;
      const r = code.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
    });
    expect(onScreen).toBe(true);
  });

  test('drops the heading the app bar already shows', async ({ page }) => {
    await page.goto('/dashboard/id-card');
    await page.getByAltText('Live QR').waitFor({ timeout: 20_000 });

    // The app bar says DIGITAL ID; repeating it in the page costs the vertical
    // space the live code needs.
    await expect(page.getByRole('heading', { name: 'Digital ID Card' })).toHaveCount(0);
    await expect(page.getByText('Present this live QR to the scanner')).toBeVisible();
  });
});

test.describe('anti-leak canary (id card)', () => {
  test('the web keeps its full-page heading and layout', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      userAgent: devices['Pixel 7'].userAgent, // no sentinel
      storageState: 'tests/e2e/.auth/trainee.json',
    });
    const page = await ctx.newPage();
    await page.goto('/dashboard/id-card');
    await page.getByAltText('Live QR').waitFor({ timeout: 20_000 });

    await expect(page.getByRole('heading', { name: 'Digital ID Card' })).toBeVisible();

    await ctx.close();
  });
});
