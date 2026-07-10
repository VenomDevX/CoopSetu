import { NextRequest, NextResponse } from 'next/server';

export interface ApiTimingMetadata {
  orgId?: string | null;
  memberId?: string | null;
  cacheStatus?: 'HIT' | 'MISS' | 'SKIP' | 'ERROR' | null;
}

export async function withApiTiming(
  req: NextRequest,
  handler: () => Promise<NextResponse>,
  getMeta?: (res: NextResponse) => ApiTimingMetadata
): Promise<NextResponse> {
  const start = performance.now();
  const requestId = crypto.randomUUID();

  try {
    const res = await handler();
    const duration = Math.round(performance.now() - start);

    // Extract optional metadata if a callback is provided
    const meta = getMeta ? getMeta(res) : {};

    const logPayload = {
      type: 'api_timing',
      requestId,
      method: req.method,
      // URL pathname only. Excludes query params which may contain sensitive data
      route: req.nextUrl.pathname,
      status: res.status,
      durationMs: duration,
      orgId: meta.orgId ?? null,
      memberId: meta.memberId ?? null,
      cacheStatus: meta.cacheStatus ?? null,
      timestamp: new Date().toISOString(),
    };

    // Safely log the payload
    console.log(JSON.stringify(logPayload));

    // Optional: inject timing headers for debugging tools
    res.headers.set('x-request-id', requestId);
    res.headers.set('x-response-time', `${duration}ms`);

    return res;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    
    // Fallback logging if the handler throws an unhandled exception
    // In our architecture, lib/api/response.ts handle() usually catches everything
    const logPayload = {
      type: 'api_timing',
      requestId,
      method: req.method,
      route: req.nextUrl.pathname,
      status: 500,
      durationMs: duration,
      error: 'Unhandled exception bypassed response handler',
      timestamp: new Date().toISOString(),
    };

    console.error(JSON.stringify(logPayload));
    throw err;
  }
}
