import { test, expect, devices, type Browser } from '@playwright/test';

/**
 * The landing page inside the Capacitor app.
 *
 * app/page.tsx picks between components/marketing/web-landing.tsx (the
 * previous contents of that file, moved verbatim) and the purpose-built
 * native version, on the server.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('native landing', () => {
  test('serves the native landing, not the desktop one', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Empower/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Platform' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register Institution' })).toBeVisible();

    // Desktop-only set pieces must not ship to the app: the expanding
    // architecture panels and the infinite marquee.
    await expect(page.getByText('Explore Architecture')).toHaveCount(0);
    await expect(page.getByText('National Scale')).toHaveCount(0);
  });

  test('keeps the hero copy and the palette', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Train.');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Employ.');
    await expect(
      page.getByText(/unified cooperative training platform/i),
    ).toBeVisible();

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
    expect(accent).toBe('#7C5CFC');
  });

  test('does not scroll horizontally', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(600);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test('primary actions are tap-sized and lead somewhere', async ({ page }) => {
    await page.goto('/');

    const initialize = page.getByRole('button', { name: 'Initialize' });
    const box = await initialize.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/login');
  });

  test('renders the native public chrome around it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('native-public-bar')).toBeVisible();
    await expect(page.getByTestId('native-public-footer')).toBeVisible();
  });
});

test.describe('anti-leak canary (landing)', () => {
  test('the same mobile browser still gets the desktop landing page', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      userAgent: devices['Pixel 7'].userAgent, // no sentinel
    });
    const page = await ctx.newPage();
    await page.goto('/');

    // The web landing's own set pieces are intact for browsers.
    await expect(page.getByText('Explore Architecture').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register Institution' })).toHaveCount(0);
    await expect(page.getByTestId('native-public-bar')).toHaveCount(0);

    await ctx.close();
  });
});
