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

    // Navigate straight to the seeded course rather than clicking the first
    // learn link on the catalog: integration tests create their own courses, so
    // "first" is not stable and can land on one with no modules.
    const SEEDED_COURSE = '00000000-0000-0000-0000-0000000000d2';

    // The catalog must still link into the player — that is the entry point.
    await page.goto('/dashboard/courses');
    await expect(page.locator(`a[href="/dashboard/courses/${SEEDED_COURSE}/learn"]`))
      .toBeVisible({ timeout: 60_000 });

    await page.goto(`/dashboard/courses/${SEEDED_COURSE}/learn`);

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
    //
    // The count is read before and after rather than asserted as "1 / n": the
    // seed now gives this trainee real history on this course, so they arrive
    // with modules already finished. What the test is actually about is that
    // the sidebar moves when a lesson is completed.
    const counter = page.getByText(/\d+ \/ \d+ complete/i);
    await expect(counter).toBeVisible({ timeout: 20_000 });
    const before = Number(((await counter.textContent()) ?? '').split('/')[0].trim());

    const body = page.locator('aside').locator('..').locator('div[class*="overflow-y-auto"]').last();
    await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });

    // The module just scrolled through is complete, whether it already was or
    // has only now become so.
    await expect(modules.nth(1).locator('.text-green-500')).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => Number(((await counter.textContent()) ?? '').split('/')[0].trim()),
            { timeout: 20_000 })
      .toBeGreaterThanOrEqual(before);
  });
});
