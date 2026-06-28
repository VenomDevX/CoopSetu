/**
 * A citation an AI answer references — a real, permission-filtered record the
 * user can open. Source citations are emitted from a server-controlled candidate
 * set (see lib/ai/ai-context-builder.ts), so an answer can never cite a
 * fabricated or inaccessible record. Resolved to a route by lib/ai/source-href.ts.
 */
export interface AiSource {
  source_type: string;
  source_id?: string;
  source_title: string;
}
