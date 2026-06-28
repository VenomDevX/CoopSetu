import { GoogleGenAI } from '@google/genai';
import { ApiError } from '@/lib/api/errors';

/**
 * Server-side Gemini client. The API key is read from `GEMINI_API_KEY` and must
 * never be exposed to the browser (no NEXT_PUBLIC_ prefix). All AI generation in
 * the app flows through here so model selection, error mapping, and the
 * server-only boundary live in one place.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** True when an API key is configured. UI/health checks use this to degrade gracefully. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // 503: the feature is unavailable until an operator configures the key.
    throw new ApiError('INTERNAL', 'AI is not configured (missing GEMINI_API_KEY).', 503);
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/** Translate a Gemini SDK error into our ApiError envelope with a safe message. */
function mapGeminiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    (typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : undefined) ?? 0;
  if (status === 429 || /quota|rate.?limit|resource.?exhausted/i.test(msg)) {
    return new ApiError('RATE_LIMITED', 'The AI service is rate limited. Please try again shortly.', 429);
  }
  if (status === 401 || status === 403 || /api.?key|permission/i.test(msg)) {
    return new ApiError('INTERNAL', 'AI service authentication failed.', 503);
  }
  return new ApiError('INTERNAL', 'The AI request could not be completed.', 502);
}

export interface StreamArgs {
  /** System instruction — grounding rules + persona. Never streamed to the client. */
  system: string;
  /** Fully-built user prompt (facts block + the user's question). */
  prompt: string;
  /** Aborts generation when the client disconnects or presses Stop. */
  signal?: AbortSignal;
  maxOutputTokens?: number;
}

/**
 * Stream final user-facing text from Gemini, chunk by chunk. Yields only text
 * deltas — never system prompts, internal reasoning, or raw data. Honors the
 * abort signal both via the SDK and by breaking the loop.
 */
export async function* streamGemini(args: StreamArgs): AsyncGenerator<string> {
  const ai = getClient();
  let stream: AsyncGenerator<{ text?: string }>;
  try {
    stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: args.prompt,
      config: {
        systemInstruction: args.system,
        temperature: 0.2,
        maxOutputTokens: args.maxOutputTokens ?? 1024,
        abortSignal: args.signal,
      },
    });
  } catch (err) {
    throw mapGeminiError(err);
  }

  try {
    for await (const chunk of stream) {
      if (args.signal?.aborted) return;
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (err) {
    if (args.signal?.aborted) return;
    throw mapGeminiError(err);
  }
}
