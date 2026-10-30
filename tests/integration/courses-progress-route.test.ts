import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CourseService } from '@/services/course.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('SUPABASE_SECRET_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function freshTraineeRow(admin: SupabaseClient): Promise<{ traineeId: string; client: SupabaseClient }> {
  const email = `courses-progress-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = process.env.TEST_USER_PASSWORD ?? 'testpass123';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  await admin.from('organization_members').insert({ organization_id: ORG, user_id: data.user.id, is_active: true });
  const { data: role } = await admin.from('roles').select('id').eq('code', 'TRAINEE').is('organization_id', null).single();
  const { data: member } = await admin.from('organization_members').select('id').eq('organization_id', ORG).eq('user_id', data.user.id).single();
  await admin.from('member_roles').insert({ organization_member_id: member!.id, role_id: role!.id });
  const { data: trainee } = await admin.from('trainees').insert({ user_id: data.user.id, organization_id: ORG, status: 'ACTIVE' }).select('id').single();
  const client = createClient(URL, KEY);
  await client.auth.signInWithPassword({ email, password });
  return { traineeId: trainee!.id, client };
}

/**
 * Phase 8 (offline PWA): the download flow (app/dashboard/courses/page.tsx)
 * needs a real GET /api/v1/courses/[courseId] to fetch a module's
 * content_url/content_text (the list embed only carries id/title/type), and
 * the sync flow (lib/offline/sync.ts) needs GET/POST
 * /api/v1/courses/[courseId]/progress to persist queued progress. Both wire
 * CourseService methods (getById/getProgress/updateProgress) that were
 * fully written but had zero callers before this phase.
 */
describe('Course detail + progress against real RLS', () => {
  let admin: SupabaseClient, trainer: SupabaseClient;
  let courseId: string, moduleId: string;

  beforeAll(async () => {
    admin = createClient(URL, ADMIN_KEY);
    trainer = await asUser('trainer@coopsetu.test');

    const { data: programme } = await admin.from('programmes').insert({
      organization_id: ORG, title: `Offline Test Programme ${Date.now()}`, duration_days: 30, status: 'ACTIVE',
    }).select('id').single();
    const { data: course } = await admin.from('courses').insert({
      programme_id: programme!.id, title: 'Offline Test Course', status: 'ACTIVE',
    }).select('id').single();
    courseId = course!.id;

    const { data: mod } = await admin.from('course_modules').insert({
      course_id: courseId, title: 'Offline Test Module', type: 'PDF',
      content_url: 'https://example.com/offline-test.pdf', content_text: 'Full module text for offline viewing.',
    }).select('id').single();
    moduleId = mod!.id;
  }, 60000);

  it('CourseService.getById returns the module\'s content_url/content_text (what the download route needs)', async () => {
    const svc = new CourseService(trainer);
    const course = await svc.getById(courseId);
    const fetchedModule = (course.course_modules ?? []).find((m: any) => m.id === moduleId);
    expect(fetchedModule?.content_url).toBe('https://example.com/offline-test.pdf');
    expect(fetchedModule?.content_text).toBe('Full module text for offline viewing.');
  });

  it('a trainee can record their own progress, and it is readable back (org-wide SELECT convention)', async () => {
    const { client, traineeId } = await freshTraineeRow(admin);
    const svc = new CourseService(client);

    const updated = await svc.updateProgress(traineeId, courseId, moduleId, 100);
    expect(updated.completed).toBe(true);
    expect(updated.progress_pct).toBe(100);

    const trainerSvc = new CourseService(trainer);
    const progress = await trainerSvc.getProgress(traineeId, courseId);
    expect(progress.some((p: any) => p.module_id === moduleId && p.completed)).toBe(true);
  });

  it('a trainee cannot record progress on another trainee\'s behalf (RLS rejects even a real trainee_id)', async () => {
    const { client } = await freshTraineeRow(admin);
    const { traineeId: otherTraineeId } = await freshTraineeRow(admin);

    const svc = new CourseService(client);
    await expect(svc.updateProgress(otherTraineeId, courseId, moduleId, 100)).rejects.toThrow();
  });

  it('a TRAINER (course:manage) can add a module; a bare trainee cannot', async () => {
    const trainerSvc = new CourseService(trainer);
    const added = await trainerSvc.addModule({ course_id: courseId, title: 'Trainer-added Module', type: 'DOCUMENT', content_text: 'Added via addModule.' });
    expect(added.title).toBe('Trainer-added Module');

    const { client } = await freshTraineeRow(admin);
    const traineeSvc = new CourseService(client);
    await expect(traineeSvc.addModule({ course_id: courseId, title: 'Should be rejected', type: 'DOCUMENT' })).rejects.toThrow();
  });

  it('repeated updateProgress calls for the same trainee/course/module upsert rather than duplicate', async () => {
    const { client, traineeId } = await freshTraineeRow(admin);
    const svc = new CourseService(client);

    await svc.updateProgress(traineeId, courseId, moduleId, 40);
    await svc.updateProgress(traineeId, courseId, moduleId, 100);

    const progress = await svc.getProgress(traineeId, courseId);
    const rows = progress.filter((p: any) => p.module_id === moduleId);
    expect(rows).toHaveLength(1);
    expect(rows[0].progress_pct).toBe(100);
    expect(rows[0].completed).toBe(true);
  });
});
