// Single source of truth mapping an AI citation's `source_type` to the stable
// detail route for that record. Used by every surface that renders AI sources
// (AiPanel, AI Daily Brief) and by tests, so a citation can never drift to a
// route that does not exist. Unknown/unsupported types return null and render as
// a non-clickable label rather than linking somewhere wrong.

export interface AiSourceLike {
  source_type: string;
  source_id?: string | null;
}

/** type → URL builder. Every supported AI source has a real, org-scoped page. */
export const AI_SOURCE_ROUTES: Record<string, (id: string) => string> = {
  task: (id) => `/dashboard/tasks/${id}`,
  project: (id) => `/dashboard/projects/${id}`,
  incident: (id) => `/dashboard/incidents/${id}`,
  bug: (id) => `/dashboard/qa-security/bugs/${id}`,
  security_review: (id) => `/dashboard/qa-security/security-reviews/${id}`,
  release: (id) => `/dashboard/releases/${id}`,
  approval_request: (id) => `/dashboard/approvals/${id}`,
};

/** Resolve the clickable destination for a citation, or null when none exists. */
export function sourceHref(s: AiSourceLike): string | null {
  if (!s.source_id) return null;
  const build = AI_SOURCE_ROUTES[s.source_type];
  return build ? build(s.source_id) : null;
}
