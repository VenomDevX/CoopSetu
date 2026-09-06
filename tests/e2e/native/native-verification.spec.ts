import { test, expect } from '@playwright/test';

// Public verification must work with no session at all — that is the whole
// point. Explicitly no storageState, unlike every other native spec.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('public certificate verification', () => {
  test('a stranger can verify, and sees revoked and unknown states honestly', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/verify');
    await expect(page.getByRole('heading', { name: /verify a certificate/i })).toBeVisible({ timeout: 60_000 });

    // Valid
    await page.goto('/verify/CERT-NCCT-2026-000101');
    await expect(page.getByRole('heading', { name: /valid certificate/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Aman Yadav')).toBeVisible();

    // Revoked must not read as valid.
    await page.goto('/verify/CERT-NCCT-2026-000103');
    await expect(page.getByRole('heading', { name: /not valid/i })).toBeVisible({ timeout: 30_000 });

    // Unknown number says so rather than implying revocation.
    await page.goto('/verify/CERT-NCCT-2026-999999');
    await expect(page.getByText(/no certificate matches/i)).toBeVisible({ timeout: 30_000 });
  });
});
