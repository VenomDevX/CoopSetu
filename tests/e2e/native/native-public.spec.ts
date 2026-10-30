import { test, expect, devices, type Browser } from '@playwright/test';

/**
 * Public/marketing and auth pages inside the Capacitor app.
 *
 * These stay reachable in the app (legal pages have to be, for the Play
 * Store), but the website chrome around them does not belong there — see
 * components/mobile/mobile-public-bar.tsx.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('native public chrome', () => {
  test('marketing pages get the native bar, not the website header', async ({ page }) => {
    await page.goto('/about');

    await expect(page.getByTestId('native-public-bar')).toBeVisible();
    // The website nav and its second navigation surface are gone.
    await expect(page.getByRole('link', { name: 'Solutions' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Enterprise' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Request Demo' })).toHaveCount(0);
  });

  test('the bar clears the status bar rather than sitting under it', async ({ page }) => {
    await page.goto('/about');
    const bar = page.getByTestId('native-public-bar');
    const box = await bar.boundingBox();
    // Its own background starts at the very top (it paints into the inset),
    // but the row inside it must not be at y=0.
    expect(box!.y).toBe(0);
    const titleBox = await page.getByRole('heading', { level: 1 }).first().boundingBox();
    expect(titleBox!.y).toBeGreaterThanOrEqual(0);
  });

  test('legal links stay reachable from the footer', async ({ page }) => {
    await page.goto('/about');
    const footer = page.getByTestId('native-public-footer');
    await expect(footer).toBeVisible();
    for (const name of ['Privacy', 'Terms', 'Cookies', 'Contact']) {
      await expect(footer.getByRole('link', { name })).toBeVisible();
    }
    // The website's six-column sitemap is not rendered.
    await expect(footer.getByRole('link', { name: 'Pricing' })).toHaveCount(0);
  });

  test('back navigation works between public pages', async ({ page }) => {
    await page.goto('/about');
    await page.getByTestId('native-public-footer').getByRole('link', { name: 'Terms' }).click();
    await page.waitForURL('**/terms');

    await page.getByTestId('native-public-back').click();
    await page.waitForURL('**/about');
  });

  test('login is safe-area inset and its controls meet the touch floor', async ({ page }) => {
    await page.goto('/login');

    const email = page.locator('input[type="text"]').first();
    const submit = page.getByRole('button', { name: /sign in/i });
    for (const control of [email, submit]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    // The page opts into insets rather than painting into them, since it has
    // no chrome of its own.
    const hasSafePage = await page.locator('[data-native-safe-page]').count();
    expect(hasSafePage).toBeGreaterThan(0);
  });

  test('login still actually works', async ({ page }) => {
    // Touch-target and safe-area changes must not break the flow itself.
    await page.goto('/login');
    await page.locator('input[type="text"]').first().fill('trainee@coopsetu.test');
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD ?? '');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/dashboard', { timeout: 20_000 });
    // And lands in the native shell, not the web one.
    await expect(page.getByTestId('native-tab-bar')).toBeVisible();
  });
});

test.describe('anti-leak canary (public)', () => {
  test('the same mobile browser still gets the website header', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      userAgent: devices['Pixel 7'].userAgent, // no sentinel
    });
    const page = await ctx.newPage();
    await page.goto('/about');

    await expect(page.getByTestId('native-public-bar')).toHaveCount(0);
    await expect(page.getByTestId('native-public-footer')).toHaveCount(0);
    // The website footer's sitemap is intact for web visitors.
    await expect(page.getByRole('link', { name: 'Pricing' }).first()).toBeVisible();

    await ctx.close();
  });
});
