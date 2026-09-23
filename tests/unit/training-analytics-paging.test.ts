import { describe, it, expect } from 'vitest';
import { allRows, allRowsIn } from '@/services/training-analytics.service';

// A fake PostgREST: serves `total` rows ordered by id, never more than 1000
// per request (max_rows in supabase/config.toml), paged by "id > after".
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: String(i).padStart(6, '0') }));
  const calls: (string | null)[] = [];
  const page = (after: string | null, limit: number) => {
    calls.push(after);
    const start = after === null ? 0 : rows.findIndex((r) => r.id > after);
    return Promise.resolve({ data: rows.slice(start, start + Math.min(limit, 1000)), error: null });
  };
  return { page, calls };
}

describe('allRows', () => {
  it('reads past the 1000-row cap instead of silently truncating', async () => {
    const { page, calls } = fakeTable(2500);
    const rows = await allRows(page);
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
    // Each page continues after the last id of the previous one.
    expect(calls).toEqual([null, '000999', '001999']);
  });

  it('stops after one request when everything fits', async () => {
    const { page, calls } = fakeTable(10);
    expect(await allRows(page)).toHaveLength(10);
    expect(calls).toHaveLength(1);
  });

  it('surfaces a query error rather than returning partial data', async () => {
    const page = () => Promise.resolve({ data: null as { id: string }[] | null, error: new Error('boom') });
    await expect(allRows(page)).rejects.toThrow('boom');
  });
});

describe('allRowsIn', () => {
  it('splits a long IN list so no request carries more than 150 ids', async () => {
    const ids = Array.from({ length: 1072 }, (_, i) => `id-${i}`);
    const seen: number[] = [];
    const rows = await allRowsIn(ids, (chunk) => {
      seen.push(chunk.length);
      return Promise.resolve({ data: chunk.map((id) => ({ id })), error: null });
    });
    expect(Math.max(...seen)).toBeLessThanOrEqual(150);
    expect(seen.reduce((a, b) => a + b, 0)).toBe(1072);
    expect(rows.map((r) => r.id)).toEqual(ids);
  });

  it('makes no request for an empty list', async () => {
    let calls = 0;
    const rows = await allRowsIn<{ id: string }>([], () => { calls++; return Promise.resolve({ data: [], error: null }); });
    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });
});
