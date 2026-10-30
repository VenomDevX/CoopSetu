import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from './errors';

export type ApiMeta = Record<string, unknown> | undefined;

export function ok<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ data, error: null, meta: meta ?? null }, { status });
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
  correlationId?: string,
) {
  return NextResponse.json(
    {
      data: null,
      error: { code, message, details: details ?? null, correlationId: correlationId ?? null },
      meta: null,
    },
    { status },
  );
}

// Client-safe text for any 5xx. The real cause is logged server-side against the
// correlation ID; the user can quote that ID to support without us ever leaking
// stack traces, database error text, or other internal details.
const GENERIC_500 =
  'Something went wrong. Please try again, or contact support with the correlation ID below.';

/**
 * Wraps a route handler body, translating thrown ApiError / ZodError into the
 * standard response envelope.
 *
 * 5xx errors never return their internal message/details to the client — many
 * call sites do `Errors.internal(dbError.message)`, which would otherwise leak
 * raw Postgres/query text. Those are logged server-side with a correlation ID
 * and replaced with a generic message. Sub-500 ApiErrors carry deliberate,
 * user-facing messages and pass through unchanged.
 */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status >= 500) {
        const correlationId = crypto.randomUUID();
        console.error(`[api] [${correlationId}] ${err.code}: ${err.message}`, err.details ?? '');
        return fail('INTERNAL', GENERIC_500, err.status, null, correlationId);
      }
      return fail(err.code, err.message, err.status, err.details);
    }
    if (err instanceof ZodError) {
      const details = process.env.NODE_ENV === 'production' ? null : err.flatten();
      return fail('VALIDATION_ERROR', 'Invalid request.', 422, details);
    }
    const correlationId = crypto.randomUUID();
    console.error(`[api] [${correlationId}] unhandled error`, err);
    return fail('INTERNAL', GENERIC_500, 500, null, correlationId);
  }
}

// Postgres / PostgREST codes that are the caller's fault, with safe wording.
const PG_CLIENT_ERRORS: Record<string, [number, string]> = {
  '23505': [409, 'That record already exists.'],
  '23503': [400, 'A referenced record does not exist.'],
  '23502': [400, 'A required field is missing.'],
  '23514': [400, 'A value is not allowed.'],
  '22P02': [400, 'A value has the wrong format.'],
  '22007': [400, 'A date or time has the wrong format.'],
  '42501': [403, 'You do not have permission to perform this action.'],
  PGRST116: [404, 'Resource not found.'],
};

/**
 * Error response for routes still on the legacy `{ error: string }` envelope
 * (their pages read `json.error` as text). Same contract as handle(): known
 * client errors get a safe message, a deliberate sub-500 `status` keeps the
 * thrown message, and anything else is logged with a correlation ID and never
 * echoes database text back to the caller.
 */
export function legacyError(err: unknown, status = 500): NextResponse {
  const e = err as { code?: string; message?: string } | null;
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue?.path.join('.');
    return NextResponse.json({ error: where ? `${where}: ${issue.message}` : 'Invalid request.' }, { status: 400 });
  }
  if (err instanceof ApiError && err.status < 500) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (status < 500) {
    return NextResponse.json({ error: e?.message || 'Bad request.' }, { status });
  }
  const known = e?.code ? PG_CLIENT_ERRORS[e.code] : undefined;
  if (known) return NextResponse.json({ error: known[1] }, { status: known[0] });

  const correlationId = crypto.randomUUID();
  console.error(`[api] [${correlationId}] unhandled error`, err);
  return NextResponse.json({ error: `${GENERIC_500} (${correlationId})` }, { status: 500 });
}
