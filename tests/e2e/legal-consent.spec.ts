import { test, expect } from '@playwright/test';

async function fillSignupStep1(page: any, name: string, email: string) {
  await page.goto('/signup');
  await page.fill('input[type="text"]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'Password123!@#');
  await page.locator('input[type="password"]').nth(1).fill('Password123!@#');
}

test.describe('Legal consent: signup checkbox', () => {
  test('Create Account stays disabled until the Terms/Privacy checkbox is checked', async ({ page }) => {
    const email = `legal-checkbox-${Date.now()}@example.com`;
    await fillSignupStep1(page, 'Legal Checkbox Test', email);

    const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(continueBtn).toBeDisabled();

    await page.check('input[type="checkbox"]');
    await expect(continueBtn).toBeEnabled();

    await page.uncheck('input[type="checkbox"]');
    await expect(continueBtn).toBeDisabled();
  });

  test('links to Terms and Privacy are present on the signup form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('a[href="/terms"]')).toBeVisible();
    await expect(page.locator('a[href="/privacy"]')).toBeVisible();
  });
});

test.describe('Legal consent: server-side enforcement', () => {
  test('a user who never accepted cannot create an organization via the API', async ({ page }) => {
    const email = `legal-bypass-${Date.now()}@example.com`;
    await fillSignupStep1(page, 'Legal Bypass Test', email);

    // Block the client's own acceptance call so this simulates a client that
    // never completed consent (e.g. a tampered frontend) reaching a real
    // authenticated session without a recorded acceptance.
    await page.route('**/api/v1/legal/accept', (route) => route.abort());
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/onboarding/legal-consent', { timeout: 15000 });

    const res = await page.request.post('/api/v1/organizations', {
      data: { name: 'Bypass Attempt Org', slug: `bypass-${Date.now()}` },
    });
    expect(res.status()).toBe(403);
  });

  test('a user with no recorded acceptance is routed to /onboarding/legal-consent, not /onboarding/profile', async ({ page }) => {
    const email = `legal-gate-${Date.now()}@example.com`;
    await fillSignupStep1(page, 'Legal Gate Test', email);

    await page.route('**/api/v1/legal/accept', (route) => route.abort());
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');

    await page.waitForURL('**/onboarding/legal-consent', { timeout: 15000 });
    await expect(page.locator('text=Before using Handoff')).toBeVisible();
  });

  test('direct navigation to /dashboard without acceptance redirects to legal-consent (backstop)', async ({ page }) => {
    const email = `legal-dashboard-backstop-${Date.now()}@example.com`;
    await fillSignupStep1(page, 'Legal Dashboard Backstop', email);

    await page.route('**/api/v1/legal/accept', (route) => route.abort());
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/onboarding/legal-consent', { timeout: 15000 });

    await page.unroute('**/api/v1/legal/accept');
    await page.goto('/dashboard');
    await page.waitForURL('**/onboarding/legal-consent', { timeout: 15000 });
  });

  test('accepting on /onboarding/legal-consent lets the resolver continue to profile', async ({ page }) => {
    const email = `legal-accept-continue-${Date.now()}@example.com`;
    await fillSignupStep1(page, 'Legal Accept Continue', email);

    await page.route('**/api/v1/legal/accept', (route) => route.abort());
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/onboarding/legal-consent', { timeout: 15000 });

    await page.unroute('**/api/v1/legal/accept');
    const consentCheckbox = page.locator('input[type="checkbox"]');
    await consentCheckbox.check();
    await page.click('button:has-text("Continue")');

    await page.waitForURL('**/onboarding/profile', { timeout: 15000 });
  });
});

test.describe('Legal pages: responsive layout', () => {
  const viewports = {
    mobile: { width: 375, height: 812 },
    desktop: { width: 1440, height: 900 },
  };

  for (const path of ['/terms', '/privacy', '/cookies']) {
    for (const [name, vp] of Object.entries(viewports)) {
      test(`${path} has no horizontal overflow on ${name}`, async ({ page }) => {
        await page.setViewportSize(vp);
        await page.goto(path);
        const noHorizontalScroll = await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        );
        expect(noHorizontalScroll).toBe(true);
      });
    }
  }

  for (const [name, vp] of Object.entries(viewports)) {
    test(`/onboarding/legal-consent has no horizontal overflow on ${name}`, async ({ page }) => {
      const email = `legal-responsive-${name}-${Date.now()}@example.com`;
      await fillSignupStep1(page, 'Legal Responsive Test', email);
      await page.route('**/api/v1/legal/accept', (route) => route.abort());
      await page.check('input[type="checkbox"]');
      await page.click('button:has-text("Continue")');
      await page.waitForURL('**/onboarding/legal-consent', { timeout: 15000 });

      await page.setViewportSize(vp);
      const noHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(noHorizontalScroll).toBe(true);
    });
  }
});

test.describe('Legal consent: demo mode', () => {
  test('demo notice is visible and links to Terms/Privacy, with no consent checkbox', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.locator('text=Demo usage is subject to our')).toBeVisible();
    await expect(page.locator('a[href="/terms"]')).toBeVisible();
    await expect(page.locator('a[href="/privacy"]')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  });
});
