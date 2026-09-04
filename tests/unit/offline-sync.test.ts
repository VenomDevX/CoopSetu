import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListPendingSubmissions = vi.fn();
const mockRemovePendingSubmission = vi.fn();
const mockListPendingProgress = vi.fn();
const mockRemovePendingProgress = vi.fn();

vi.mock('@/lib/offline/db', () => ({
  listPendingSubmissions: (...args: any[]) => mockListPendingSubmissions(...args),
  removePendingSubmission: (...args: any[]) => mockRemovePendingSubmission(...args),
  listPendingProgress: (...args: any[]) => mockListPendingProgress(...args),
  removePendingProgress: (...args: any[]) => mockRemovePendingProgress(...args),
}));

import { flushOfflineQueues } from '@/lib/offline/sync';

const submission = (overrides = {}) => ({
  id: 's1', assessmentId: 'a1', assessmentTitle: 'Quiz', answers: { q1: 'A' }, queuedAt: '2026-01-01T00:00:00Z', ...overrides,
});
const progress = (overrides = {}) => ({
  id: 'p1', courseId: 'c1', moduleId: 'm1', moduleTitle: 'Module', progressPct: 100, queuedAt: '2026-01-01T00:00:00Z', ...overrides,
});

describe('flushOfflineQueues()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPendingSubmissions.mockResolvedValue([]);
    mockListPendingProgress.mockResolvedValue([]);
  });

  it('POSTs each queued submission to the real assessment results route and removes it on success', async () => {
    mockListPendingSubmissions.mockResolvedValue([submission()]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'r1' } }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await flushOfflineQueues();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/assessments/a1/results', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ answers: { q1: 'A' } }),
    }));
    expect(mockRemovePendingSubmission).toHaveBeenCalledWith('s1');
    expect(result.submissionsSynced).toBe(1);
    expect(result.submissionsFailed).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('leaves a submission queued (does not remove it) when fetch itself fails — still offline', async () => {
    mockListPendingSubmissions.mockResolvedValue([submission()]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await flushOfflineQueues();

    expect(mockRemovePendingSubmission).not.toHaveBeenCalled();
    expect(result.submissionsSynced).toBe(0);
    expect(result.submissionsFailed).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('removes and reports a submission the server genuinely rejects (e.g. attempts exhausted) — does not retry forever', async () => {
    mockListPendingSubmissions.mockResolvedValue([submission()]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403, json: async () => ({ error: 'No attempts remaining for this assessment.' }),
    }));

    const result = await flushOfflineQueues();

    expect(mockRemovePendingSubmission).toHaveBeenCalledWith('s1');
    expect(result.submissionsSynced).toBe(0);
    expect(result.submissionsFailed).toEqual([{ item: submission(), error: 'No attempts remaining for this assessment.' }]);

    vi.unstubAllGlobals();
  });

  it('POSTs each queued progress update to the real course progress route and removes it on success', async () => {
    mockListPendingProgress.mockResolvedValue([progress()]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await flushOfflineQueues();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/courses/c1/progress', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ module_id: 'm1', progress_pct: 100 }),
    }));
    expect(mockRemovePendingProgress).toHaveBeenCalledWith('p1');
    expect(result.progressSynced).toBe(1);

    vi.unstubAllGlobals();
  });

  it('leaves a progress update queued when still offline, same as submissions', async () => {
    mockListPendingProgress.mockResolvedValue([progress()]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await flushOfflineQueues();

    expect(mockRemovePendingProgress).not.toHaveBeenCalled();
    expect(result.progressSynced).toBe(0);
    expect(result.progressFailed).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('processes multiple queued items of both types independently', async () => {
    mockListPendingSubmissions.mockResolvedValue([submission({ id: 's1' }), submission({ id: 's2', assessmentId: 'a2' })]);
    mockListPendingProgress.mockResolvedValue([progress({ id: 'p1' })]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }));

    const result = await flushOfflineQueues();

    expect(result.submissionsSynced).toBe(2);
    expect(result.progressSynced).toBe(1);
    expect(mockRemovePendingSubmission).toHaveBeenCalledTimes(2);
    expect(mockRemovePendingProgress).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
