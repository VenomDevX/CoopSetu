import { test, expect } from '@playwright/test';

// Unauthenticated tests for public pages
test.use({ storageState: { cookies: [], origins: [] } });

const viewports = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1024, height: 768 },
  desktopLarge: { width: 1280, height: 800 },
  ultrawide: { width: 1440, height: 900 }
};

test.describe('Public Pages and Navigation E2E', () => {
  // 1. Verify all routes render and show correct titles
  test('renders About, Contact, Privacy, and Terms routes', async ({ page }) => {
    // About
    await page.goto('/about');
    await expect(page.getByText('ABOUT_HANDOFF')).toBeVisible();
    await expect(page.getByText('BUILT_BY')).toBeVisible();
    await expect(page.getByRole('link', { name: /linkedin/i })).toBeVisible();

    // Contact
    await page.goto('/contact');
    await expect(page.getByText('CONTACT_HANDOFF')).toBeVisible();
    await expect(page.getByRole('button', { name: /send message/i })).toBeVisible();

    // Privacy
    await page.goto('/privacy');
    await expect(page.getByText('Privacy Policy')).toBeVisible();
    await expect(page.getByText('legal draft')).toBeVisible();

    // Terms
    await page.goto('/terms');
    await expect(page.getByText('Terms of Service')).toBeVisible();
    await expect(page.getByText('legal draft')).toBeVisible();
  });

  // 2. Contact form input validation and submission
  test('Contact form validates fields and submits successfully', async ({ page }) => {
    await page.goto('/contact');

    // Fill contact form
    await page.locator('#fullName').fill('E2E Tester');
    await page.locator('#workEmail').fill('e2etest@example.com');
    await page.locator('#companyName').fill('E2E Corp');
    await page.locator('#companySize').selectOption('11-50');
    await page.locator('#role').fill('Quality Engineer');
    await page.locator('#topic').selectOption('Request a Demo');
    await page.locator('#message').fill('This is a test message from Playwright E2E suites.');

    // Submit
    await page.getByRole('button', { name: /send message/i }).click();

    // Verify success state
    await expect(page.getByText('SUBMISSION_RECEIVED')).toBeVisible();
    await expect(page.getByText('Thank you. Your message has been securely transmitted.')).toBeVisible();
  });

  // 3. Footer links click and navigate correctly
  test('Footer links navigate correctly', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Go to About via footer
    await footer.getByRole('link', { name: /about/i }).click();
    await expect(page).toHaveURL(/\/about$/);

    // Go to Contact via footer
    await footer.getByRole('link', { name: /contact/i }).click();
    await expect(page).toHaveURL(/\/contact$/);

    // Go to Terms via footer
    await footer.getByRole('link', { name: /terms/i }).click();
    await expect(page).toHaveURL(/\/terms$/);

    // Go to Privacy via footer
    await footer.getByRole('link', { name: /privacy/i }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  // 4. Responsive checks: No horizontal overflow on any viewport
  for (const [name, vp] of Object.entries(viewports)) {
    test(`No horizontal overflow on /about on ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/about');
      const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
    });

    test(`No horizontal overflow on /contact on ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/contact');
      const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
    });

    test(`No horizontal overflow on /privacy on ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/privacy');
      const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
    });

    test(`No horizontal overflow on /terms on ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/terms');
      const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHorizontalScroll).toBe(true);
    });
  }
});
