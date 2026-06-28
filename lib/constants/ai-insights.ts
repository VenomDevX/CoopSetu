// Client-safe registry of the role-scoped AI "intelligence" intents. The UI uses
// it to show only the insights a member is permitted; the service uses the same
// permission lists to enforce access on the server (UI gating is never the gate).

export const AI_INSIGHT_INTENTS = ['my-focus', 'qa-security', 'release-readiness', 'exec-briefing'] as const;
export type AiInsightIntent = (typeof AI_INSIGHT_INTENTS)[number];

export interface AiInsightMeta {
  intent: AiInsightIntent;
  label: string;
  description: string;
  /** Any one of these permissions grants access (in addition to `ai:use`). */
  permissions: string[];
}

export const AI_INSIGHTS: AiInsightMeta[] = [
  { intent: 'my-focus', label: 'My Focus', description: 'Your assigned, blocked, and due tasks', permissions: ['task:view'] },
  { intent: 'qa-security', label: 'QA & Security Digest', description: 'Open bugs, QA tasks, pending reviews', permissions: ['qa:view', 'security:view'] },
  { intent: 'release-readiness', label: 'Release Readiness', description: 'In-flight releases, gates, approvals', permissions: ['release:view'] },
  { intent: 'exec-briefing', label: 'Executive Briefing', description: 'Portfolio health across projects', permissions: ['analytics:view'] },
];

export const AI_INSIGHT_META: Record<AiInsightIntent, AiInsightMeta> =
  Object.fromEntries(AI_INSIGHTS.map((m) => [m.intent, m])) as Record<AiInsightIntent, AiInsightMeta>;
