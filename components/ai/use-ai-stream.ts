'use client';

import { useCallback, useRef, useState } from 'react';
import type { AiSource } from '@/components/ai/ai-panel';

export interface AiStreamBody {
  intent: string;
  prompt?: string;
  project_id?: string;
  sprint_id?: string;
  task_id?: string;
  incident_id?: string;
  release_id?: string;
}

interface AiStreamState {
  answer: string;
  sources: AiSource[];
  loading: boolean;
  error: string | null;
  done: boolean;
}

const INITIAL: AiStreamState = { answer: '', sources: [], loading: false, error: null, done: false };

/**
 * Consume the `/api/v1/ai/stream` SSE endpoint. Appends `token` events to
 * `answer`, captures `sources` after completion, and exposes `stop()` which
 * aborts via AbortController (the server marks the run CANCELLED and never saves
 * partial output as a final answer).
 */
export function useAiStream() {
  const [state, setState] = useState<AiStreamState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async (body: AiStreamBody) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ ...INITIAL, loading: true });

    try {
      const res = await fetch('/api/v1/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        setState({ ...INITIAL, error: j?.error?.message ?? 'The AI request could not be completed.' });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          if (event === 'token') {
            const text = (parsed as { text?: string }).text ?? '';
            setState((s) => ({ ...s, answer: s.answer + text }));
          } else if (event === 'sources') {
            setState((s) => ({ ...s, sources: parsed as AiSource[] }));
          } else if (event === 'error') {
            const message = (parsed as { message?: string }).message ?? 'The AI request failed.';
            setState((s) => ({ ...s, error: message }));
          } else if (event === 'done') {
            setState((s) => ({ ...s, loading: false, done: true }));
          }
        }
      }
      setState((s) => ({ ...s, loading: false, done: true }));
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setState((s) => ({ ...s, loading: false }));
      } else {
        setState({ ...INITIAL, error: 'Network error — please try again.' });
      }
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, run, stop, reset };
}
