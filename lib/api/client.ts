/**
 * Thin client-side fetch helpers for /api/v1. They unwrap the `{ data, error }`
 * envelope and throw on failure so React Query (or callers) see real errors
 * instead of silently-swallowed ones.
 */
export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(
      json?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      json?.error?.code,
    );
  }
  return json?.data as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function apiSend<T>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  return request<T>(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
