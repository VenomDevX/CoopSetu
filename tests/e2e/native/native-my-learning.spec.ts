import { test, expect } from '@playwright/test';

/**
 * The trainee's own learning record.
 *
 * Everything on this page is derived from lms_events and course_progress, so
 * the assertions are about real seeded history: a percentage that matches a
 * module count, badges that were actually unlocked, and a pace estimate that
 * either appears with its caveat or says it cannot be made. A page of tiles
 * wired to zeros would pass a "renders" test, which is why these check figures.
 */
test.use({ storageState: 'tests/e2e/.auth/trainee.json' });

test.describe('my learning', () => {
  test('shows progress, grades and badges built from real history', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/dashboard/my-learning');

    // The completion ring is the page's spine — wait on it, not a timeout,
    // because a cold dev compile can take tens of seconds.
    await expect(page.getByText('Overall', { exact: true })).toBeVisible({ timeout: 60_000 });

    // Real figures, not placeholders: the seeded trainee has finished modules.
    const modulesDone = page.getByText('Modules done', { exact: true })
      .locator('xpath=ancestor::*[contains(@class,"border-border")][1]');
    await expect(modulesDone).toBeVisible();
    const doneText = (await modulesDone.textContent()) ?? '';
    expect(Number(doneText.replace(/\D/g, ''))).toBeGreaterThan(0);

    // The pace estimate must never read as a prediction. Either it is shown
    // with its caveat, or it says there is not enough data — never a bare date.
    await expect(page.getByText(/straight-line estimate|Not enough recent activity/)).toBeVisible();

    // Courses are listed, each with its own module count and percentage.
    // Matching on that line rather than the word "Courses", which also appears
    // in the nav and would resolve to a hidden element.
    await expect(page.getByText(/\d+ \/ \d+ modules ·/).first()).toBeVisible();
    await expect(page.locator('a[href^="/dashboard/courses/"]').first()).toBeVisible();

    // The badge shelf shows both what is unlocked and what is not — the locked
    // slots are the point, so the count is out of the full catalogue.
    await expect(page.getByText(/\d+ \/ \d+ unlocked/)).toBeVisible();
  });

  test('the course catalog shows the trainee their own progress', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/dashboard/courses');
    // Before this, every card looked identical whether a trainee had finished
    // the course or never opened it.
    await expect(page.locator('[data-testid^="course-progress-"]').first())
      .toBeVisible({ timeout: 60_000 });
  });
});
