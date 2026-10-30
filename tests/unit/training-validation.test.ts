import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { traineeCreate, traineeUpdate, batchCreate, assessmentCreate, allocationCheckOut } from '@/lib/validation/training';
import { legacyError } from '@/lib/api/response';

const SEED_ID = '00000000-0000-0000-0000-0000000000a0';

describe('training request schemas', () => {
  it('drops columns the endpoint does not expose', () => {
    const parsed = traineeCreate.parse({
      user_id: SEED_ID, education: 'B.Com',
      status: 'GRADUATED', organization_id: SEED_ID, face_embedding: [1, 2, 3],
    });
    expect(parsed).toEqual({ user_id: SEED_ID, education: 'B.Com' });
    expect(traineeUpdate.parse({ id: SEED_ID, user_id: SEED_ID, location: 'Pune' })).toEqual({ location: 'Pune' });
  });

  it('accepts seed-style IDs without an RFC version digit', () => {
    expect(allocationCheckOut.parse({ allocation_id: SEED_ID })).toEqual({ allocation_id: SEED_ID });
  });

  it('normalises form input: blanks become absent, numeric strings become numbers', () => {
    const parsed = batchCreate.parse({ programme_id: SEED_ID, name: 'B-1', trainer_id: '', room: '', capacity: '30' });
    expect(parsed).toEqual({ programme_id: SEED_ID, name: 'B-1', capacity: 30 });
  });

  it('keeps is_published so published assessments stay visible to trainees', () => {
    expect(assessmentCreate.parse({ course_id: SEED_ID, title: 'Quiz', is_published: true }).is_published).toBe(true);
  });

  it('rejects a missing required field', () => {
    expect(batchCreate.safeParse({ name: 'B-1' }).success).toBe(false);
  });
});

describe('legacyError', () => {
  const body = async (r: Response) => (await r.json()) as { error: string };

  it('maps a unique violation to 409 without echoing database text', async () => {
    const r = legacyError({ code: '23505', message: 'duplicate key value violates unique constraint "x_pkey"' });
    expect(r.status).toBe(409);
    expect((await body(r)).error).not.toMatch(/constraint/);
  });

  it('turns validation errors into a 400 naming the field', async () => {
    const r = legacyError(batchCreate.safeParse({ name: 'B-1' }).error as z.ZodError);
    expect(r.status).toBe(400);
    expect((await body(r)).error).toMatch(/programme_id/);
  });

  it('keeps a deliberate client-error message', async () => {
    const r = legacyError(new Error('Hostel is full'), 409);
    expect(r.status).toBe(409);
    expect((await body(r)).error).toBe('Hostel is full');
  });

  it('hides unexpected errors behind a generic message with a correlation ID', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = legacyError(new Error('relation "secret_table" does not exist'));
    expect(r.status).toBe(500);
    const { error } = await body(r);
    expect(error).not.toMatch(/secret_table/);
    expect(error).toMatch(/[0-9a-f-]{36}/);
    spy.mockRestore();
  });
});
