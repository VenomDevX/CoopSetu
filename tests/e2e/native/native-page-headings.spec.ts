import { test, expect, devices, type Browser } from '@playwright/test';

/**
 * Page titles in the app.
 *
 * The mobile app bar names the current screen (derived from the nav), so each
 * page's own <h1> repeats it — two h1s on one screen, the second saying what
 * the sticky bar above it already says. In the app the page copy is dropped;
 * on the web, where there is no app bar, it stays.
 */
test.use({ storageState: 'tests/e2e/.auth/trainee.json' });

const PAGES: Array<{ path: string; webHeading: string }> = [
  { path: '/dashboard/attendance', webHeading: 'Attendance System' },
  { path: '/dashboard/assessments', webHeading: 'Assessments' },
  { path: '/dashboard/certificates', webHeading: 'Digital Certificates' },
  { path: '/dashboard/skill-passport', webHeading: 'Skill Passport' },
  { path: '/dashboard/courses', webHeading: 'Course Catalog' },
];

test.describe('native page headings', () => {
  for (const { path, webHeading } of PAGES) {
    test(`${path} shows one heading, not two`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(1200);

      // Exactly one h1 in the document — the app bar's — and none in the page.
      // Deliberately not asserting the heading TEXT is absent: on
      // /dashboard/assessments and /dashboard/skill-passport the app bar's own
      // title is word-for-word the page heading, so a text query would match
      // the bar and fail for the wrong reason. Location is the real assertion.
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main h1')).toHaveCount(0);
      await expect(page.locator('header h1')).toHaveCount(1);
      // The page's distinctive wording is gone where it differed from the bar.
      if (webHeading !== (await page.locator('header h1').textContent())?.trim()) {
        await expect(page.getByText(webHeading, { exact: true })).toHaveCount(0);
      }
    });
  }

  test('the app bar still names the screen', async ({ page }) => {
    // Removing the page heading is only safe because the bar carries the name.
    await page.goto('/dashboard/certificates');
    await expect(page.locator('header h1')).toHaveText('Certificates');
  });
});

test.describe('anti-leak canary (headings)', () => {
  test('the web keeps every page heading', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
      userAgent: devices['Pixel 7'].userAgent, // no sentinel
      storageState: 'tests/e2e/.auth/trainee.json',
    });
    const page = await ctx.newPage();

    for (const { path, webHeading } of PAGES) {
      await page.goto(path);
      await page.waitForTimeout(1000);
      await expect(
        page.getByRole('heading', { name: webHeading, exact: true }),
        `${path} should keep its heading on the web`,
      ).toBeVisible();
    }

    await ctx.close();
  });
});
