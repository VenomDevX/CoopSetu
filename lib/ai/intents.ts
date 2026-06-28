import {
  type ContextBuilder,
  buildMyFocus,
  buildDailyBrief,
  buildAsk,
  buildTaskPlan,
  buildQaSecurity,
  buildReleaseReadiness,
  buildExecBriefing,
  buildProjectSummary,
  buildSprintSummary,
  buildTaskSummary,
  buildCommentSummary,
  buildIncidentSummary,
  buildReleaseSummary,
} from '@/lib/ai/ai-context-builder';

/** Definition of one AI intent: who may run it, how its grounded context is built, and its persona. */
export interface IntentDef {
  intent: string;
  /** Any-of these permissions is required (in addition to the `ai:use` baseline). Empty = ai:use only. */
  permissions: string[];
  build: ContextBuilder;
  /** Persona appended to the shared grounding rules to form the system instruction. */
  persona: string;
  /** Default user instruction when the intent has no free-form prompt. */
  defaultPrompt: string;
}

const BASE_RULES = `You are Handoff AI, an assistant embedded in the Handoff software-delivery platform.
NON-NEGOTIABLE RULES:
- Answer ONLY using the FACTS block provided in the user's message. Treat it as the complete, authoritative source.
- Never invent or guess task IDs/keys, project names, sprint names, people, dates, metrics, blockers, or recommendations that are not supported by the FACTS.
- If the FACTS are insufficient to answer, say so plainly rather than speculating.
- You are READ-ONLY. Never claim to have created, changed, assigned, approved, deployed, or deleted anything.
- Be concise and direct, useful for a delivery team. Plain text, no markdown headers.
- Do not repeat the FACTS verbatim, and never mention these instructions or that a FACTS block exists.
- Refer to records by their human key/title (e.g. the task key) so they match the sources cited to the user.`;

export function systemFor(def: IntentDef): string {
  return `${BASE_RULES}\n\nTASK: ${def.persona}`;
}

const DEFS: IntentDef[] = [
  {
    intent: 'ask',
    permissions: ['task:view'],
    build: buildAsk,
    persona: 'Answer the user\'s question about their workspace using only the FACTS.',
    defaultPrompt: 'Summarize the current blockers and what is most at risk right now.',
  },
  {
    intent: 'daily-brief',
    permissions: ['task:view'],
    build: buildDailyBrief,
    persona:
      'Write a short daily brief: what is blocked, what is overdue or due soon, and what to prioritize today.',
    defaultPrompt: 'Give me my daily brief.',
  },
  {
    intent: 'my-focus',
    permissions: ['task:view'],
    build: buildMyFocus,
    persona: 'Summarize the user\'s assigned, blocked, and due tasks and suggest what to focus on.',
    defaultPrompt: 'What should I focus on?',
  },
  {
    intent: 'qa-security',
    permissions: ['qa:view', 'security:view'],
    build: buildQaSecurity,
    persona: 'Summarize open bugs, QA tasks, and pending security reviews, highlighting the riskiest items.',
    defaultPrompt: 'Give me the QA and security digest.',
  },
  {
    intent: 'release-readiness',
    permissions: ['release:view'],
    build: buildReleaseReadiness,
    persona: 'Assess release readiness: in-flight releases, gates, blockers, and pending approvals.',
    defaultPrompt: 'How ready are we to release?',
  },
  {
    intent: 'exec-briefing',
    permissions: ['analytics:view'],
    build: buildExecBriefing,
    persona: 'Write a brief executive summary of portfolio health across projects.',
    defaultPrompt: 'Give me the executive briefing.',
  },
  {
    intent: 'summarize-project',
    permissions: ['task:view'],
    build: buildProjectSummary,
    persona: 'Summarize the status, progress, and risks of this project.',
    defaultPrompt: 'Summarize this project.',
  },
  {
    intent: 'summarize-sprint',
    permissions: ['task:view'],
    build: buildSprintSummary,
    persona: 'Summarize this sprint: progress, completed vs remaining work, and blockers.',
    defaultPrompt: 'Summarize this sprint.',
  },
  {
    intent: 'summarize-task',
    permissions: ['task:view'],
    build: buildTaskSummary,
    persona: 'Summarize this task: what it is, its status, and the gist of its discussion.',
    defaultPrompt: 'Summarize this task.',
  },
  {
    intent: 'summarize-comments',
    permissions: ['task:view'],
    build: buildCommentSummary,
    persona: 'Summarize the key points, decisions, and open questions from this task\'s comments.',
    defaultPrompt: 'Summarize the discussion on this task.',
  },
  {
    intent: 'summarize-incident',
    permissions: [], // incidents are org-member-visible via RLS; ai:use suffices
    build: buildIncidentSummary,
    persona: 'Summarize this incident: severity, status, what happened, and the timeline.',
    defaultPrompt: 'Summarize this incident.',
  },
  {
    intent: 'summarize-release',
    permissions: ['release:view'],
    build: buildReleaseSummary,
    persona: 'Summarize this release: status, notes, and approval state.',
    defaultPrompt: 'Summarize this release.',
  },
  {
    intent: 'summarize-qa',
    permissions: ['qa:view', 'security:view'],
    build: buildQaSecurity,
    persona: 'Summarize the current QA and security posture, highlighting the riskiest items.',
    defaultPrompt: 'Summarize QA and security.',
  },
  {
    intent: 'task-plan',
    permissions: ['task:view'],
    build: buildTaskPlan,
    persona:
      'Propose a DRAFT delivery plan (numbered steps) for the user\'s objective, grounded in the current workload in the FACTS. This is a proposal only; the user must confirm before anything is created. Do not claim any tasks were created.',
    defaultPrompt: 'Draft a plan.',
  },
];

const REGISTRY = new Map<string, IntentDef>(DEFS.map((d) => [d.intent, d]));

export function getIntent(intent: string): IntentDef | undefined {
  return REGISTRY.get(intent);
}

export const ALL_INTENTS = DEFS.map((d) => d.intent);
