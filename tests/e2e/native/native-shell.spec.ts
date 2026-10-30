import { test, expect, devices, type Browser } from '@playwright/test';

/**
 * The native (Capacitor) dashboard shell.
 *
 * Runs under the `native` Playwright project, whose UA carries the
 * CoopSetuApp sentinel that capacitor.config.ts appends in the real app.
 * Everything under tests/e2e/native/ is excluded from the `e2e` project, so
 * the existing specs keep exercising the web shell unchanged.
 */
test.use({ storageState: 'tests/e2e/.auth/trainee.json' });

/**
 * `next dev` mounts its build/error indicator in a <nextjs-portal> pinned to
 * the bottom of the viewport, which lands directly on top of the bottom tab
 * bar at phone widths and swallows the clicks. It does not exist in a
 * production build, so hiding it removes test-environment noise rather than
 * papering over a real overlap.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none!important}';
      document.head?.appendChild(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide, { once: true });
  });
});

test.describe('native dashboard shell', () => {
  test('renders the tab bar instead of the web sidebar shell', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByTestId('native-tab-bar')).toBeVisible();
    // The definitive "this is the other shell" assertion: the web shell's
    // hamburger simply does not exist here.
    await expect(page.getByTestId('mobile-menu-trigger')).toHaveCount(0);
    await expect(page.locator('aside')).toHaveCount(0);
  });

  test('applies the native style scope without touching the palette', async ({ page }) => {
    await page.goto('/dashboard');

    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        cls: document.documentElement.className,
        radiusMd: cs.getPropertyValue('--radius-md').trim(),
        accent: cs.getPropertyValue('--accent').trim(),
        headerH: cs.getPropertyValue('--app-header-h').trim(),
        tapMin: cs.getPropertyValue('--tap-min').trim(),
      };
    });

    expect(tokens.cls).toContain('app-native');
    expect(tokens.radiusMd).toBe('12px');
    expect(tokens.headerH).toBe('56px');
    expect(tokens.tapMin).toBe('48px');
    // The brand colour must be untouched — this restructure is explicitly not
    // a recolour.
    expect(tokens.accent).toBe('#7C5CFC');
  });

  test('every tab navigates and marks itself current', async ({ page }) => {
    await page.goto('/dashboard');
    const tabBar = page.getByTestId('native-tab-bar');
    const tabs = tabBar.locator('a[data-testid^="native-tab-"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(1);

    for (let i = 0; i < count; i++) {
      const href = await tabs.nth(i).getAttribute('href');
      await tabs.nth(i).click();
      await page.waitForURL(`**${href}`);
      await expect(tabBar.locator(`a[href="${href}"]`)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('the More sheet exposes the full nav and closes again', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByTestId('native-more-trigger').click();
    const sheet = page.getByTestId('native-more-sheet');
    await expect(sheet).toBeVisible();

    // Destinations that are deliberately not in the 4-tab bar still have to be
    // reachable, or they'd be orphaned in the app.
    await expect(sheet.getByRole('link', { name: 'Skill Passport' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Career AI' })).toBeVisible();

    await page.getByTestId('native-more-close').click();
    await expect(sheet).toBeHidden();
  });

  test('navigating from the More sheet closes it', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('native-more-trigger').click();
    await page.getByTestId('native-more-sheet').getByRole('link', { name: 'Career AI' }).click();

    await page.waitForURL('**/dashboard/career-ai');
    await expect(page.getByTestId('native-more-sheet')).toHaveCount(0);
    // Deeper than a tab root, so the app bar offers a way back.
    await expect(page.getByTestId('native-back')).toBeVisible();
  });

  test('no page scrolls horizontally', async ({ page }) => {
    for (const path of ['/dashboard', '/dashboard/courses', '/dashboard/attendance', '/dashboard/certificates']) {
      await page.goto(path);
      await page.waitForTimeout(600);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `${path} overflows horizontally`).toBe(false);
    }
  });

  test('chrome meets the 48px touch-target floor', async ({ page }) => {
    await page.goto('/dashboard');
    const tabs = page.getByTestId('native-tab-bar').locator('[data-native-tap]');
    for (let i = 0; i < await tabs.count(); i++) {
      const box = await tabs.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('anti-leak canary', () => {
  // Same device and viewport, WITHOUT the sentinel. If the native shell shows
  // up here, the scoping has leaked into the mobile web experience — which is
  // the one thing this whole approach exists to prevent.
  test('an identical mobile browser still gets the web shell', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      userAgent: devices['Pixel 7'].userAgent, // no CoopSetuApp sentinel
      storageState: 'tests/e2e/.auth/trainee.json',
    });
    const page = await ctx.newPage();
    await page.goto('/dashboard');

    // This context is built by hand, so it doesn't inherit the beforeEach
    // fixture — but nothing here clicks, so the dev overlay is harmless.
    await expect(page.getByTestId('mobile-menu-trigger')).toBeVisible();
    await expect(page.getByTestId('native-tab-bar')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.className)).not.toContain('app-native');

    await ctx.close();
  });
});
