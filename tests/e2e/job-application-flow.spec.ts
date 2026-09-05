import { test, expect, type Browser, type BrowserContext } from '@playwright/test';

const EMPLOYER_USER_ID = '00000000-0000-0000-0000-000000000005'; // employer@coopsetu.test

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

/**
 * Finds the employer's own company profile, self-registering it if it doesn't
 * exist yet (employers_self_insert: user_id = auth.uid()). Looked up by
 * user_id rather than a fixed company name: `employers` has a UNIQUE(user_id,
 * organization_id) constraint, so this account may already have a row from
 * another suite (e.g. the RLS integration tests) under a different name.
 */
async function ensureOwnEmployer(employerCtx: BrowserContext): Promise<string> {
  const list = await employerCtx.request.get('/api/v1/employers');
  const listJson = await list.json();
  const existing = (listJson?.data?.employers ?? []).find((e: any) => e.user_id === EMPLOYER_USER_ID);
  if (existing) return existing.id;

  const res = await employerCtx.request.post('/api/v1/employers', {
    data: { user_id: EMPLOYER_USER_ID, company_name: 'E2E Job Flow Co' },
  });
  expect(res.ok(), `create employer failed: ${res.status()}`).toBeTruthy();
  const json = await res.json();
  return json.data.id as string;
}

/**
 * The highest-risk flow in the applications feature: a trainee applies to a
 * job, and the posting employer sees and shortlists that application. Drives
 * both sides through the real UI (Apply button on /dashboard/jobs, the
 * expand-to-review flow on /dashboard/applications), with only the job/
 * employer prerequisite created via the API (matching this suite's existing
 * pattern in role-workflows.spec.ts of using context.request for setup that
 * isn't the flow under test).
 */
test('job application flow: trainee applies, employer sees and shortlists', async ({ browser }) => {
  const employerCtx = await ctx(browser, 'employer');
  const traineeCtx = await ctx(browser, 'trainee');

  const employerId = await ensureOwnEmployer(employerCtx);
  const jobTitle = `E2E Apply Flow Job ${Date.now()}`;
  const jobRes = await employerCtx.request.post('/api/v1/jobs', {
    data: { employer_id: employerId, title: jobTitle, status: 'OPEN', employment_type: 'FULL_TIME', vacancies: 1 },
  });
  expect(jobRes.ok(), `create job failed: ${jobRes.status()}`).toBeTruthy();
  const jobId = (await jobRes.json()).data.id as string;

  // --- Trainee applies via the real UI ---
  const traineePage = await traineeCtx.newPage();
  await traineePage.goto('/dashboard/jobs');
  await traineePage.getByPlaceholder('Search jobs...').fill(jobTitle);

  const jobCard = traineePage.getByTestId(`job-card-${jobId}`);
  await expect(jobCard).toBeVisible();
  await jobCard.getByRole('button', { name: /^Apply$/ }).click();
  await expect(jobCard.getByText('Applied', { exact: true })).toBeVisible({ timeout: 10_000 });

  // --- Employer sees and shortlists via the real UI ---
  const employerPage = await employerCtx.newPage();
  await employerPage.goto('/dashboard/applications');
  await employerPage.getByPlaceholder('Search jobs...').fill(jobTitle);

  const applicationsCard = employerPage.getByTestId(`job-card-${jobId}`);
  await expect(applicationsCard).toBeVisible();
  await applicationsCard.getByText(jobTitle).click();
  await expect(applicationsCard.getByText('Student Trainee')).toBeVisible({ timeout: 10_000 });

  await applicationsCard.getByRole('button', { name: 'Shortlist' }).click();
  // "SHORTLISTED" also appears as an <option> in the status <select>; scope to
  // the visible status badge <span> to avoid a strict-mode ambiguity.
  await expect(applicationsCard.locator('span', { hasText: 'SHORTLISTED' })).toBeVisible({ timeout: 10_000 });

  await traineeCtx.close();
  await employerCtx.close();
});
