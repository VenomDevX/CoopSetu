import { test, expect, type Browser } from '@playwright/test';

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

/**
 * Phase 9 (i18n infrastructure): the language switcher must toggle the
 * locale (and <html lang>) without breaking navigation or auth-guarded
 * redirects — the plan's own stated highest regression risk for this phase.
 *
 * Phase 10 added real Hindi translations (messages/hi.json is no longer an
 * English-content placeholder) for the core subset: nav, auth, dashboard
 * shell, and the five highest-traffic pages (dashboard home, trainees,
 * attendance, certificates, courses). The tests below assert those specific
 * Hindi strings actually render — per the plan's explicit Phase 10 test
 * requirement ("extend the i18n e2e smoke spec to assert Hindi renders
 * correctly on each newly in-scope page").
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
    // Phase 10: Auth namespace now carries real Hindi translations.
    await expect(page.getByRole('heading', { name: 'साइन इन करें' })).toBeVisible();

    // The auth-guarded flow itself must still work after switching locale —
    // this plan's own stated highest regression risk for this phase. The
    // submit button's own label is now in Hindi too (same t('signIn') key),
    // so assert on that rather than the stale English string.
    await page.locator('input[type="text"]').first().fill('trainee@coopsetu.test');
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD ?? '');
    await page.getByRole('button', { name: 'साइन इन करें' }).click();
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

    // Nav still renders and is still navigable after the locale switch —
    // the Nav namespace carries real Hindi (retroactively translated in
    // Phase 10), so these labels are now Hindi, not English.
    await expect(page.getByText('करियर एआई')).toBeVisible();
    await page.getByRole('link', { name: 'नौकरियां' }).click();
    await expect(page).toHaveURL(/\/dashboard\/jobs/);
    // The jobs page itself is outside Phase 10's translated scope — its
    // heading stays English regardless of locale.
    await expect(page.getByText('Employment Exchange')).toBeVisible();

    await traineeCtx.close();
  });

  test('Hindi renders correctly on the dashboard home (Command Center)', async ({ browser }) => {
    const traineeCtx = await ctx(browser, 'trainee');
    const page = await traineeCtx.newPage();
    await page.goto('/dashboard');
    await expect(page.getByText('Overview')).toBeVisible();

    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // This heading only appears once the client-side dashboard-overview
    // fetch resolves (see app/dashboard/page.tsx's mounted/data-gated
    // render), which is slower than a static page's locale switch — give it
    // more headroom than the default 15s.
    await expect(page.getByRole('heading', { name: 'कमांड सेंटर' })).toBeVisible({ timeout: 25_000 });
    // No stray untranslated "Command Center" (the English fallback) should
    // leak through once the real client-side data has loaded.
    await expect(page.getByText('Command Center', { exact: true })).toHaveCount(0);

    await traineeCtx.close();
  });

  test('Hindi renders correctly on the trainees page', async ({ browser }) => {
    const adminCtx = await ctx(browser, 'instituteAdmin');
    const page = await adminCtx.newPage();
    await page.goto('/dashboard/trainees');
    await expect(page.getByRole('heading', { name: 'Registered Trainees' })).toBeVisible();

    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    await expect(page.getByRole('heading', { name: 'पंजीकृत प्रशिक्षु' })).toBeVisible();

    await adminCtx.close();
  });

  test('Hindi renders correctly on the attendance page', async ({ browser }) => {
    const adminCtx = await ctx(browser, 'instituteAdmin');
    const page = await adminCtx.newPage();
    await page.goto('/dashboard/attendance');
    await expect(page.getByRole('heading', { name: 'Attendance System' })).toBeVisible();

    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    await expect(page.getByRole('heading', { name: 'उपस्थिति प्रणाली' })).toBeVisible();

    await adminCtx.close();
  });

  test('Hindi renders correctly on the certificates page', async ({ browser }) => {
    const adminCtx = await ctx(browser, 'instituteAdmin');
    const page = await adminCtx.newPage();
    await page.goto('/dashboard/certificates');
    await expect(page.getByRole('heading', { name: 'Digital Certificates' })).toBeVisible();

    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    await expect(page.getByRole('heading', { name: 'डिजिटल प्रमाणपत्र' })).toBeVisible();

    await adminCtx.close();
  });

  test('Hindi renders correctly on the courses page', async ({ browser }) => {
    const traineeCtx = await ctx(browser, 'trainee');
    const page = await traineeCtx.newPage();
    await page.goto('/dashboard/courses');
    await expect(page.getByRole('heading', { name: 'Course Catalog' })).toBeVisible();

    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    await expect(page.getByRole('heading', { name: 'पाठ्यक्रम सूची' })).toBeVisible();

    await traineeCtx.close();
  });
});
