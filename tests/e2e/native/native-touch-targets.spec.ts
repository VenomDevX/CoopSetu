import { test, expect, devices, type Browser } from '@playwright/test';

/**
 * Touch targets inside page content.
 *
 * These pages were measured on a Pixel 7 before the fix: Courses' "Download"
 * came out at 28px (it hard-codes h-7), Jobs' "Apply" at 36px and the Jobs
 * status filters at 33px — all real trainee actions, all under the 48dp
 * guideline. The floor is applied by a scoped rule in globals.css rather than
 * per page, because those sizes come from a mix of the shared Button
 * primitive and per-page height overrides.
 */
test.use({ storageState: 'tests/e2e/.auth/trainee.json' });

const PAGES = [
  '/dashboard',
  '/dashboard/courses',
  '/dashboard/jobs',
  '/dashboard/assessments',
  '/dashboard/certificates',
  '/dashboard/attendance',
];

test.describe('native touch targets', () => {
  for (const path of PAGES) {
    test(`controls on ${path} meet the touch floor`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(1200);

      const undersized = await page.evaluate(() => {
        return [...document.querySelectorAll('main button, main select')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.height > 0 && r.height < 44;
          })
          .map((el) => ({
            text: (el.textContent || '').trim().slice(0, 30),
            height: Math.round(el.getBoundingClientRect().height),
          }));
      });

      expect(undersized, `undersized controls on ${path}`).toEqual([]);
    });
  }

  test('raising the floor did not introduce horizontal overflow', async ({ page }) => {
    // min-height on a control inside a tight row is the obvious way this could
    // go wrong, so it is checked rather than assumed.
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForTimeout(800);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `${path} overflows horizontally`).toBe(false);
    }
  });
});

test.describe('anti-leak canary (touch targets)', () => {
  test('the web app keeps its compact controls', async ({ browser }: { browser: Browser }) => {
    // The web's dense sizing is deliberate; the floor must not reach it.
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      userAgent: devices['Pixel 7'].userAgent, // no sentinel
      storageState: 'tests/e2e/.auth/trainee.json',
    });
    const page = await ctx.newPage();
    await page.goto('/dashboard/courses');
    await page.waitForTimeout(1500);

    const smallest = await page.evaluate(() => {
      const heights = [...document.querySelectorAll('main button')]
        .map((el) => el.getBoundingClientRect().height)
        .filter((h) => h > 0);
      return heights.length ? Math.min(...heights) : null;
    });

    // Courses' Download button is h-7 on the web and must stay that way.
    expect(smallest).not.toBeNull();
    expect(smallest!).toBeLessThan(44);

    await ctx.close();
  });
});
