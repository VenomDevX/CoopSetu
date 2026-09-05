import { test, expect, type Browser } from '@playwright/test';

const ctx = (browser: Browser, role: string) =>
  browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

/**
 * The highest-risk flow in the assessments feature: a trainee takes a quiz
 * and gets a real, server-computed score (not a client-supplied one), and
 * staff can review the result. Programme/course/assessment/question creation
 * is done via the API as setup (matching this suite's existing pattern in
 * job-application-flow.spec.ts of using context.request for prerequisites
 * that aren't the flow under test); taking the quiz and reviewing results
 * both go through the real UI.
 */
test('assessment flow: trainee takes a quiz and gets a real score, staff sees the result', async ({ browser }) => {
  const adminCtx = await ctx(browser, 'instituteAdmin');
  const traineeCtx = await ctx(browser, 'trainee');

  const programmeRes = await adminCtx.request.post('/api/v1/programmes', {
    data: { title: `E2E Assessment Flow Programme ${Date.now()}`, duration_days: 30 },
  });
  expect(programmeRes.ok(), `create programme failed: ${programmeRes.status()}`).toBeTruthy();
  const programmeId = (await programmeRes.json()).data.id as string;

  const courseRes = await adminCtx.request.post('/api/v1/courses', {
    data: { programme_id: programmeId, title: 'E2E Assessment Flow Course' },
  });
  expect(courseRes.ok(), `create course failed: ${courseRes.status()}`).toBeTruthy();
  const courseId = (await courseRes.json()).data.id as string;

  const quizTitle = `E2E Quiz ${Date.now()}`;
  const assessmentRes = await adminCtx.request.post('/api/v1/assessments', {
    data: { course_id: courseId, title: quizTitle, max_score: 10, attempts_allowed: 1, is_published: true },
  });
  expect(assessmentRes.ok(), `create assessment failed: ${assessmentRes.status()}`).toBeTruthy();
  const assessmentId = (await assessmentRes.json()).data.id as string;

  const questionRes = await adminCtx.request.post(`/api/v1/assessments/${assessmentId}/questions`, {
    data: { question_text: '2 + 2 = ?', question_type: 'MCQ', options: ['3', '4', '5'], correct_answer: '4', marks: 10 },
  });
  expect(questionRes.ok(), `add question failed: ${questionRes.status()}`).toBeTruthy();

  // --- Trainee takes the quiz via the real UI ---
  const traineePage = await traineeCtx.newPage();
  await traineePage.goto('/dashboard/assessments');
  await traineePage.getByPlaceholder('Search assessments...').fill(quizTitle);

  const traineeCard = traineePage.getByTestId(`assessment-card-${assessmentId}`);
  await expect(traineeCard).toBeVisible();
  await traineeCard.getByText(quizTitle).click();

  // Staff-only data must never reach the trainee taking the quiz.
  await expect(traineeCard.getByText('Correct:')).toHaveCount(0);

  await traineeCard.getByRole('radio', { name: '4', exact: true }).check();
  await traineeCard.getByRole('button', { name: 'Submit Answers' }).click();
  await expect(traineeCard.getByText(/^Passed/)).toBeVisible({ timeout: 10_000 });
  await expect(traineeCard.getByText('10/10')).toBeVisible();

  // --- Staff reviews the result via the real UI ---
  const adminPage = await adminCtx.newPage();
  await adminPage.goto('/dashboard/assessments');
  await adminPage.getByPlaceholder('Search assessments...').fill(quizTitle);

  const adminCard = adminPage.getByTestId(`assessment-card-${assessmentId}`);
  await expect(adminCard).toBeVisible();
  await adminCard.getByText(quizTitle).click();

  await expect(adminCard.getByText('Student Trainee')).toBeVisible({ timeout: 10_000 });
  await expect(adminCard.getByText('10/10 · Attempt 1')).toBeVisible();

  await traineeCtx.close();
  await adminCtx.close();
});
