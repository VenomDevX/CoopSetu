import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from './errors';

export type ApiMeta = Record<string, unknown> | undefined;

export function ok<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ data, error: null, meta: meta ?? null }, { status });
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { data: null, error: { code, message, details: details ?? null }, meta: null },
    { status },
  );
}

/**
 * Wraps a route handler body, translating thrown ApiError / ZodError into the
 * standard response envelope.
 */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, err.details);
    }
    if (err instanceof ZodError) {
      const details = process.env.NODE_ENV === 'production' ? null : err.flatten();
      return fail('VALIDATION_ERROR', 'Invalid request.', 422, details);
    }
    console.error('[api] unhandled error', err);
    return fail('INTERNAL', 'Something went wrong.', 500);
  }
}
