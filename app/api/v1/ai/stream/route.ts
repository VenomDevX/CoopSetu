import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { fail } from '@/lib/api/response';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { requireLegalAccepted } from '@/lib/legal/require-legal-accepted';
import { getIntent } from '@/lib/ai/intents';
import { checkIntentPermissions } from '@/lib/ai/ai-permission-checks';
import { buildAiStream } from '@/lib/ai/ai-streaming';
import { rateLimit } from '@/lib/security/rate-limit';

// Separate, stricter budget than the generic /api/v1/* bucket — both to
// blunt automated prompt-injection probing and to bound Gemini cost exposure.
// Keyed by member id (not IP) so distributed/NAT'd traffic from one account
// can't dodge it, and one account's abuse can't drown out others behind the
// same IP.
const AI_RATE_LIMIT = 20;
const AI_RATE_WINDOW_MS = 5 * 60 * 1000;

export const runtime = 'nodejs';

const schema = z.object({
  intent: z.string().min(1),
  prompt: z.string().max(2000).optional(),
  project_id: z.string().uuid().optional(),
  sprint_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  incident_id: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
}).strict();

/**
 * Single streaming endpoint for every AI intent. All gates — auth, org, `ai:use`,
 * and the intent's feature permission — run here and return JSON (incl. 403)
 * BEFORE any stream opens. Context building, permission-filtered, happens inside
 * the stream. Only final user-facing text is streamed; the API key never leaves
 * the server.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await requireUser();
    const m = await requireOrganization();
    const body = schema.parse(await req.json());

    const def = getIntent(body.intent);
    if (!def) return fail('VALIDATION_ERROR', 'Unknown AI intent.', 422);

    if (m.isDemo) {
      return fail('DEMO_AI_DISABLED', 'AI is unavailable in the public demo workspace.', 403);
    }

    const rl = rateLimit(`ai:member:${m.memberId}`, AI_RATE_LIMIT, AI_RATE_WINDOW_MS);
    if (!rl.success) {
      return fail('RATE_LIMITED', 'Too many AI requests. Please wait a few minutes and try again.', 429);
    }

    await requireLegalAccepted(user, supabase);

    checkIntentPermissions(m, def.permissions);

    const stream = buildAiStream({
      supabase,
      m,
      intent: body.intent,
      params: {
        prompt: body.prompt,
        projectId: body.project_id,
        sprintId: body.sprint_id,
        taskId: body.task_id,
        incidentId: body.incident_id,
        releaseId: body.release_id,
      },
      signal: req.signal,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.code, err.message, err.status, err.details);
    if (err instanceof ZodError) return fail('VALIDATION_ERROR', 'Invalid request.', 422, err.flatten());
    console.error('[ai/stream] error', err);
    return fail('INTERNAL', 'Something went wrong.', 500);
  }
}
