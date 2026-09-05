import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  saveModule, getModule, listModules, deleteModule,
  queueSubmission, listPendingSubmissions, removePendingSubmission,
  queueProgress, listPendingProgress, removePendingProgress,
  type CachedModule,
} from '@/lib/offline/db';

// Each test uses its own distinct ids (rather than resetting the whole
// fake-indexeddb database between tests) so tests never collide with each
// other's records regardless of run order.
let n = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${n++}`;

describe('lib/offline/db — modules (cached course-module metadata)', () => {
  it('saveModule() then getModule() round-trips exactly what was saved', async () => {
    const id = uid('mod');
    const mod: CachedModule = {
      id, courseId: 'c1', courseTitle: 'Course 1', title: 'Module 1', type: 'PDF',
      contentUrl: 'https://example.com/a.pdf', contentText: undefined, cachedAt: new Date().toISOString(),
    };
    await saveModule(mod);
    const fetched = await getModule(id);
    expect(fetched).toEqual(mod);
  });

  it('getModule() returns undefined for an id that was never saved', async () => {
    expect(await getModule(uid('missing'))).toBeUndefined();
  });

  it('listModules() includes every saved module', async () => {
    const id1 = uid('mod'); const id2 = uid('mod');
    await saveModule({ id: id1, courseId: 'c1', courseTitle: 'C', title: 'A', type: 'VIDEO', cachedAt: new Date().toISOString() });
    await saveModule({ id: id2, courseId: 'c1', courseTitle: 'C', title: 'B', type: 'PDF', cachedAt: new Date().toISOString() });
    const all = await listModules();
    expect(all.some((m) => m.id === id1)).toBe(true);
    expect(all.some((m) => m.id === id2)).toBe(true);
  });

  it('saveModule() with an existing id overwrites (not duplicates) the entry', async () => {
    const id = uid('mod');
    await saveModule({ id, courseId: 'c1', courseTitle: 'C', title: 'Old Title', type: 'PDF', cachedAt: '2026-01-01T00:00:00Z' });
    await saveModule({ id, courseId: 'c1', courseTitle: 'C', title: 'New Title', type: 'PDF', cachedAt: '2026-02-01T00:00:00Z' });
    const fetched = await getModule(id);
    expect(fetched?.title).toBe('New Title');
    expect((await listModules()).filter((m) => m.id === id)).toHaveLength(1);
  });

  it('deleteModule() removes the entry', async () => {
    const id = uid('mod');
    await saveModule({ id, courseId: 'c1', courseTitle: 'C', title: 'A', type: 'PDF', cachedAt: new Date().toISOString() });
    await deleteModule(id);
    expect(await getModule(id)).toBeUndefined();
  });
});

describe('lib/offline/db — pending assessment submissions queue', () => {
  it('queueSubmission() assigns an id and queuedAt, and the item appears in the list', async () => {
    const record = await queueSubmission({ assessmentId: uid('a'), assessmentTitle: 'Quiz', answers: { q1: 'A' } });
    expect(record.id).toBeTruthy();
    expect(record.queuedAt).toBeTruthy();

    const all = await listPendingSubmissions();
    expect(all.some((s) => s.id === record.id)).toBe(true);
  });

  it('removePendingSubmission() removes exactly that item', async () => {
    const a = await queueSubmission({ assessmentId: uid('a'), assessmentTitle: 'Quiz A', answers: {} });
    const b = await queueSubmission({ assessmentId: uid('a'), assessmentTitle: 'Quiz B', answers: {} });
    await removePendingSubmission(a.id);
    const all = await listPendingSubmissions();
    expect(all.some((s) => s.id === a.id)).toBe(false);
    expect(all.some((s) => s.id === b.id)).toBe(true);
  });
});

describe('lib/offline/db — pending progress queue', () => {
  it('queueProgress() then listPendingProgress() round-trips the record', async () => {
    const record = await queueProgress({ courseId: uid('c'), moduleId: uid('m'), moduleTitle: 'Module', progressPct: 100 });
    const all = await listPendingProgress();
    expect(all.some((p) => p.id === record.id && p.progressPct === 100)).toBe(true);
  });

  it('removePendingProgress() removes exactly that item', async () => {
    const a = await queueProgress({ courseId: uid('c'), moduleId: uid('m'), moduleTitle: 'A', progressPct: 100 });
    await removePendingProgress(a.id);
    expect((await listPendingProgress()).some((p) => p.id === a.id)).toBe(false);
  });
});

