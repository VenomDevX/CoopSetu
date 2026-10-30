// Client-safe registry of the role-scoped AI "intelligence" intents. The UI uses
// it to show only the insights a member is permitted; the service uses the same
// permission lists to enforce access on the server (UI gating is never the gate).

export const AI_INSIGHT_INTENTS = ['my-learning', 'trainer-dashboard', 'institution-readiness', 'national-briefing'] as const;
export type AiInsightIntent = (typeof AI_INSIGHT_INTENTS)[number];

export interface AiInsightMeta {
  intent: AiInsightIntent;
  label: string;
  description: string;
  /** Any one of these permissions grants access (in addition to `ai:use`). */
  permissions: string[];
}

export const AI_INSIGHTS: AiInsightMeta[] = [
  { intent: 'my-learning', label: 'My Learning & Jobs', description: 'Your active courses, assessments, and job matches', permissions: ['career:view'] },
  { intent: 'trainer-dashboard', label: 'Trainer Digest', description: 'Attendance, batch progress, pending assessments', permissions: ['qa:view', 'security:view'] },
  { intent: 'institution-readiness', label: 'Institution Readiness', description: 'Active programs, enrollment stats, logistics', permissions: ['release:view'] },
  { intent: 'national-briefing', label: 'National Briefing', description: 'Overall training health across institutions', permissions: ['analytics:view'] },
];

export const AI_INSIGHT_META: Record<AiInsightIntent, AiInsightMeta> =
  Object.fromEntries(AI_INSIGHTS.map((m) => [m.intent, m])) as Record<AiInsightIntent, AiInsightMeta>;
