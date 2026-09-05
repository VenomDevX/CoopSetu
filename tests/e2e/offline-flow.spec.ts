import { test, expect, type Browser } from '@playwright/test';

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

/**
 * Phase 8 (offline PWA, MVP scope): a trainee downloads a course module
 * while online, keeps viewing its content after the connection drops (real
 * IndexedDB-backed data already in the page — this MVP does not precache
 * the app shell, so it deliberately never tests a hard reload while
 * offline), and a quiz answer submitted while offline queues instead of
 * failing, then actually reaches the server once reconnected.
 *
 * Both pages are opened once, while online, and never navigated again —
 * Next.js client-side navigation to an unfetched route would itself need
 * the network, which isn't what this phase claims to support (see
 * public/sw.js's comment on why it only caches explicitly-downloaded
 * assets, not app navigation).
 */
test('offline flow: a downloaded module stays viewable offline, and an offline quiz submission queues then syncs', async ({ browser }) => {
  const adminCtx = await ctx(browser, 'instituteAdmin');
  const traineeCtx = await ctx(browser, 'trainee');

  const programmeRes = await adminCtx.request.post('/api/v1/programmes', {
    data: { title: `E2E Offline Programme ${Date.now()}`, duration_days: 30 },
  });
  expect(programmeRes.ok(), `create programme failed: ${programmeRes.status()}`).toBeTruthy();
  const programmeId = (await programmeRes.json()).data.id as string;

  const courseTitle = `E2E Offline Course ${Date.now()}`;
  const courseRes = await adminCtx.request.post('/api/v1/courses', {
    data: { programme_id: programmeId, title: courseTitle },
  });
  expect(courseRes.ok(), `create course failed: ${courseRes.status()}`).toBeTruthy();
  const courseId = (await courseRes.json()).data.id as string;

  const moduleRes = await adminCtx.request.post(`/api/v1/courses/${courseId}/modules`, {
    data: { title: 'E2E Offline Module', type: 'DOCUMENT', content_text: 'This module content must remain readable after the connection drops.' },
  });
  expect(moduleRes.ok(), `add module failed: ${moduleRes.status()}`).toBeTruthy();
  const moduleId = (await moduleRes.json()).data.id as string;

  const quizTitle = `E2E Offline Quiz ${Date.now()}`;
  const assessmentRes = await adminCtx.request.post('/api/v1/assessments', {
    data: { course_id: courseId, title: quizTitle, max_score: 10, attempts_allowed: 1, is_published: true },
  });
  expect(assessmentRes.ok(), `create assessment failed: ${assessmentRes.status()}`).toBeTruthy();
  const assessmentId = (await assessmentRes.json()).data.id as string;

  const questionRes = await adminCtx.request.post(`/api/v1/assessments/${assessmentId}/questions`, {
    data: { question_text: '2 + 2 = ?', question_type: 'MCQ', options: ['3', '4', '5'], correct_answer: '4', marks: 10 },
  });
  expect(questionRes.ok(), `add question failed: ${questionRes.status()}`).toBeTruthy();

  // --- Trainee: open both pages and download the module, all while online ---
  const coursesPage = await traineeCtx.newPage();
  await coursesPage.goto('/dashboard/courses');
  await expect(coursesPage.getByText(courseTitle)).toBeVisible();

  const moduleRow = coursesPage.getByTestId(`module-row-${moduleId}`);
  await expect(moduleRow).toBeVisible();
  await moduleRow.getByRole('button', { name: /^Download$/ }).click();
  await expect(moduleRow.getByText('Downloaded')).toBeVisible({ timeout: 10_000 });

  const assessmentsPage = await traineeCtx.newPage();
  await assessmentsPage.goto('/dashboard/assessments');
  await assessmentsPage.getByPlaceholder('Search assessments...').fill(quizTitle);
  const assessmentCard = assessmentsPage.getByTestId(`assessment-card-${assessmentId}`);
  await expect(assessmentCard).toBeVisible();
  await assessmentCard.getByText(quizTitle).click();
  await expect(assessmentCard.getByRole('radio', { name: '4', exact: true })).toBeVisible();
  await assessmentCard.getByRole('radio', { name: '4', exact: true }).check();

  // --- Go offline (affects the whole context — both open tabs) ---
  await traineeCtx.setOffline(true);

  // The downloaded module's content is still viewable — no network fetch
  // needed, it's already in the page (backed by IndexedDB).
  await moduleRow.getByText('Downloaded').click();
  await expect(moduleRow.getByText('This module content must remain readable after the connection drops.')).toBeVisible();

  // Submitting the quiz while offline queues it instead of erroring.
  await assessmentCard.getByRole('button', { name: 'Submit Answers' }).click();
  await expect(assessmentCard.getByText(/Queued/)).toBeVisible({ timeout: 10_000 });

  // --- Reconnect: the queued submission should sync automatically ---
  await traineeCtx.setOffline(false);

  await expect(async () => {
    const res = await adminCtx.request.get(`/api/v1/assessments/${assessmentId}/results`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.data.results.length).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });

  await traineeCtx.close();
  await adminCtx.close();
});
