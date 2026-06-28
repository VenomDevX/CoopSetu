import type { SupabaseClient } from '@supabase/supabase-js';
import type { Membership } from '@/lib/auth/get-current-membership';
import type { AiSource } from '@/lib/ai/provider';

/**
 * Grounded context for a single AI request. `facts` is a plain-text block of
 * real, permission-filtered data that is the ONLY material the model may use.
 * `candidates` are the real, accessible records the answer may cite — citations
 * are emitted from this server-controlled set, so the model can never cite a
 * fabricated or inaccessible record. When `isEmpty`, we skip the model entirely
 * and return `emptyMessage` (a truthful no-data state).
 */
export interface GroundedContext {
  facts: string;
  candidates: AiSource[];
  isEmpty: boolean;
  emptyMessage: string;
}

export interface IntentParams {
  prompt?: string;
  projectId?: string;
  sprintId?: string;
  taskId?: string;
  incidentId?: string;
  releaseId?: string;
}

export type ContextBuilder = (
  supabase: SupabaseClient,
  m: Membership,
  params: IntentParams,
) => Promise<GroundedContext>;

const src = (type: string, id: string, title: string): AiSource => ({
  source_type: type,
  source_id: id,
  source_title: title,
});

const today = () => new Date().toISOString().slice(0, 10);

function empty(message: string): GroundedContext {
  return { facts: '', candidates: [], isEmpty: true, emptyMessage: message };
}

// ----------------------------------------------------------- My Focus / Brief ---
async function fetchMyOpenTasks(supabase: SupabaseClient, m: Membership) {
  const { data } = await supabase
    .from('tasks')
    .select('id, task_key, title, status, due_date, is_blocked')
    .eq('organization_id', m.organizationId)
    .eq('primary_assignee_member_id', m.memberId)
    .is('archived_at', null)
    .not('status', 'in', '(DONE,CANCELLED)')
    .limit(300);
  return data ?? [];
}

export const buildMyFocus: ContextBuilder = async (supabase, m) => {
  const rows = await fetchMyOpenTasks(supabase, m);
  if (rows.length === 0) return empty('You have no open assigned tasks right now.');

  const d = today();
  const blocked = rows.filter((t) => t.status === 'BLOCKED' || t.is_blocked);
  const overdue = rows.filter((t) => t.due_date && t.due_date < d);
  const dueSoon = rows.filter((t) => {
    if (!t.due_date || t.due_date < d) return false;
    return (new Date(t.due_date).getTime() - Date.now()) / 86_400_000 <= 3;
  });

  const seen = new Set<string>();
  const priority = [...blocked, ...overdue, ...dueSoon].filter((t) =>
    seen.has(t.id) ? false : seen.add(t.id),
  );
  const cited = priority.slice(0, 10);

  const lines = cited.map(
    (t) =>
      `- ${t.task_key}: ${t.title} [status=${t.status}${t.due_date ? `, due=${t.due_date}` : ''}${t.is_blocked ? ', blocked' : ''}]`,
  );
  const facts =
    `Assigned open tasks: ${rows.length} total — ${blocked.length} blocked, ${overdue.length} overdue, ${dueSoon.length} due within 3 days.\n` +
    `Highest-priority items:\n${lines.join('\n')}`;

  return {
    facts,
    candidates: cited.map((t) => src('task', t.id, `${t.task_key}: ${t.title}`)),
    isEmpty: false,
    emptyMessage: '',
  };
};

export const buildDailyBrief: ContextBuilder = async (supabase, m, params) => {
  // Daily brief = My Focus, plus pending approvals the user can see.
  const focus = await buildMyFocus(supabase, m, params);
  const { data: approvals } = await supabase
    .from('approval_requests')
    .select('id, approval_type, status')
    .eq('organization_id', m.organizationId)
    .eq('status', 'PENDING')
    .limit(10);
  const pending = approvals ?? [];

  if (focus.isEmpty && pending.length === 0) {
    return empty('You have no open assigned tasks or pending approvals right now.');
  }

  const apprFacts = pending.length
    ? `\nPending approvals you can see: ${pending.length} (${pending.map((a) => a.approval_type).join(', ')}).`
    : '';
  const apprSources = pending
    .slice(0, 4)
    .map((a) => src('approval_request', a.id, `${a.approval_type} approval`));

  return {
    facts: (focus.facts || 'No open assigned tasks.') + apprFacts,
    candidates: [...focus.candidates, ...apprSources],
    isEmpty: false,
    emptyMessage: '',
  };
};

// ------------------------------------------------------------------- Ask ---
export const buildAsk: ContextBuilder = async (supabase, m, params) => {
  const org = m.organizationId;

  let blockedQ = supabase
    .from('tasks')
    .select('id, task_key, title')
    .eq('organization_id', org)
    .eq('status', 'BLOCKED')
    .is('archived_at', null)
    .limit(10);
  let qaQ = supabase
    .from('tasks')
    .select('id, task_key, title')
    .eq('organization_id', org)
    .eq('status', 'QA_TESTING')
    .is('archived_at', null)
    .limit(6);
  let openCountQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org)
    .not('status', 'in', '(DONE,CANCELLED)')
    .is('archived_at', null);
  let doneCountQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org)
    .eq('status', 'DONE')
    .is('archived_at', null);
  let secQ = supabase
    .from('security_reviews')
    .select('id, title, status')
    .eq('organization_id', org)
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .limit(5);

  if (params.projectId) {
    blockedQ = blockedQ.eq('project_id', params.projectId);
    qaQ = qaQ.eq('project_id', params.projectId);
    openCountQ = openCountQ.eq('project_id', params.projectId);
    doneCountQ = doneCountQ.eq('project_id', params.projectId);
    secQ = secQ.eq('project_id', params.projectId);
  }

  const [{ data: blocked }, { data: qa }, { count: open }, { count: done }, { data: sec }] =
    await Promise.all([blockedQ, qaQ, openCountQ, doneCountQ, secQ]);

  const blockedRows = blocked ?? [];
  const qaRows = qa ?? [];
  const secRows = sec ?? [];

  if (blockedRows.length === 0 && qaRows.length === 0 && secRows.length === 0 && !open && !done) {
    return empty('No workspace data is available to answer that yet.');
  }

  const facts =
    `Workspace snapshot${params.projectId ? ' (this project)' : ''}: ` +
    `${open ?? 0} open task(s), ${done ?? 0} done.\n` +
    (blockedRows.length
      ? `Blocked tasks:\n${blockedRows.map((t) => `- ${t.task_key}: ${t.title}`).join('\n')}\n`
      : '') +
    (qaRows.length
      ? `In QA:\n${qaRows.map((t) => `- ${t.task_key}: ${t.title}`).join('\n')}\n`
      : '') +
    (secRows.length
      ? `Pending security reviews:\n${secRows.map((r) => `- ${r.title} (${r.status})`).join('\n')}`
      : '');

  const candidates = [
    ...blockedRows.map((t) => src('task', t.id, `${t.task_key}: ${t.title}`)),
    ...qaRows.map((t) => src('task', t.id, `${t.task_key}: ${t.title}`)),
    ...secRows.map((r) => src('security_review', r.id, r.title)),
  ];

  return { facts, candidates, isEmpty: false, emptyMessage: '' };
};

export const buildTaskPlan: ContextBuilder = async (supabase, m, params) => {
  // Reuse the ask snapshot so the plan is grounded in current workload.
  const ctx = await buildAsk(supabase, m, params);
  return {
    ...ctx,
    isEmpty: false, // a plan can still be proposed even with little context
    facts: ctx.isEmpty ? 'No existing tasks in scope.' : ctx.facts,
    emptyMessage: '',
  };
};

// ----------------------------------------------------- QA & Security Digest ---
export const buildQaSecurity: ContextBuilder = async (supabase, m) => {
  const org = m.organizationId;
  const [{ data: bugs }, { data: qaTasks }, { data: sec }] = await Promise.all([
    supabase
      .from('bugs')
      .select('id, title, severity, status')
      .eq('organization_id', org)
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .limit(300),
    supabase
      .from('tasks')
      .select('id, task_key, title')
      .eq('organization_id', org)
      .eq('status', 'QA_TESTING')
      .is('archived_at', null)
      .limit(300),
    supabase
      .from('security_reviews')
      .select('id, title, status, risk_score')
      .eq('organization_id', org)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .limit(300),
  ]);
  const openBugs = bugs ?? [];
  const qa = qaTasks ?? [];
  const reviews = sec ?? [];
  const critical = openBugs.filter((b) => b.severity === 'CRITICAL');
  const high = openBugs.filter((b) => b.severity === 'HIGH');

  if (openBugs.length === 0 && qa.length === 0 && reviews.length === 0) {
    return empty('No open bugs, QA tasks, or pending security reviews found.');
  }

  const candidates = [
    ...[...critical, ...high].slice(0, 6).map((b) => src('bug', b.id, `${b.severity}: ${b.title}`)),
    ...reviews.slice(0, 4).map((r) => src('security_review', r.id, r.title)),
    ...qa.slice(0, 4).map((t) => src('task', t.id, `${t.task_key}: ${t.title}`)),
  ];

  const facts =
    `Open bugs: ${openBugs.length} (${critical.length} critical, ${high.length} high). ` +
    `Tasks in QA: ${qa.length}. Security reviews pending: ${reviews.length}.\n` +
    [...critical, ...high].slice(0, 6).map((b) => `- BUG ${b.severity}: ${b.title}`).join('\n');

  return { facts, candidates, isEmpty: false, emptyMessage: '' };
};

// ------------------------------------------------------- Release Readiness ---
export const buildReleaseReadiness: ContextBuilder = async (supabase, m) => {
  const org = m.organizationId;
  const [{ data: rel }, { data: appr }] = await Promise.all([
    supabase
      .from('releases')
      .select('id, name, version, status')
      .eq('organization_id', org)
      .not('status', 'in', '(DEPLOYED,ROLLED_BACK)')
      .limit(300),
    supabase
      .from('approval_requests')
      .select('id, approval_type, status')
      .eq('organization_id', org)
      .eq('status', 'PENDING')
      .limit(300),
  ]);
  const releases = rel ?? [];
  const approvals = appr ?? [];
  if (releases.length === 0 && approvals.length === 0) {
    return empty('No in-flight releases or pending approvals found.');
  }
  const blocked = releases.filter((r) => r.status === 'BLOCKED');
  const ready = releases.filter((r) => r.status === 'APPROVED_FOR_DEPLOYMENT');
  const gates = releases.filter(
    (r) => r.status !== 'BLOCKED' && r.status !== 'APPROVED_FOR_DEPLOYMENT',
  );

  const candidates = [
    ...[...blocked, ...gates]
      .slice(0, 8)
      .map((r) => src('release', r.id, `${r.name} ${r.version} (${r.status})`)),
    ...approvals.slice(0, 4).map((a) => src('approval_request', a.id, `${a.approval_type} approval`)),
  ];

  const facts =
    `In-flight releases: ${releases.length} — ${ready.length} approved for deployment, ` +
    `${gates.length} awaiting gates, ${blocked.length} blocked. Pending approvals: ${approvals.length}.\n` +
    [...blocked, ...gates]
      .slice(0, 8)
      .map((r) => `- ${r.name} ${r.version}: ${r.status}`)
      .join('\n');

  return { facts, candidates, isEmpty: false, emptyMessage: '' };
};

// -------------------------------------------------------- Executive Briefing ---
export const buildExecBriefing: ContextBuilder = async (supabase, m) => {
  const org = m.organizationId;
  const [projects, openTasks, doneTasks, blockedTasks, criticalBugs, pendingSec, incidents] =
    await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', org),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org)
        .not('status', 'in', '(DONE,CANCELLED)')
        .is('archived_at', null),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org)
        .eq('status', 'DONE')
        .is('archived_at', null),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org)
        .eq('status', 'BLOCKED')
        .is('archived_at', null),
      supabase
        .from('bugs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org)
        .eq('severity', 'CRITICAL')
        .in('status', ['OPEN', 'IN_PROGRESS']),
      supabase
        .from('security_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org)
        .in('status', ['PENDING', 'IN_PROGRESS']),
      supabase
        .from('incidents')
        .select('id, title, severity')
        .eq('organization_id', org)
        .is('resolved_at', null)
        .limit(10),
    ]);
  const p = projects.count ?? 0;
  const open = openTasks.count ?? 0;
  const done = doneTasks.count ?? 0;
  const activeIncidents = incidents.data ?? [];

  if (p === 0 && open === 0 && done === 0) {
    return empty('No project or work-item data is available yet for a briefing.');
  }
  const completion = open + done > 0 ? Math.round((done / (open + done)) * 100) : 0;
  const facts =
    `Portfolio: ${p} project(s). Tasks: ${done} done / ${open} open (${completion}% complete), ` +
    `${blockedTasks.count ?? 0} blocked. Active incidents: ${activeIncidents.length}. ` +
    `Critical bugs open: ${criticalBugs.count ?? 0}. Security reviews pending: ${pendingSec.count ?? 0}.\n` +
    activeIncidents.map((i) => `- INCIDENT ${i.severity}: ${i.title}`).join('\n');

  return {
    facts,
    candidates: activeIncidents.map((i) => src('incident', i.id, `${i.severity}: ${i.title}`)),
    isEmpty: false,
    emptyMessage: '',
  };
};

// ----------------------------------------------------------- Summaries ---------
export const buildProjectSummary: ContextBuilder = async (supabase, m, params) => {
  if (!params.projectId) return empty('No project specified.');
  const { data: proj } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.projectId)
    .maybeSingle();
  if (!proj) return empty('Project not found or not accessible.');
  const ctx = await buildAsk(supabase, m, { projectId: params.projectId });
  return {
    facts: `Project: ${proj.name}.\n${ctx.facts}`,
    candidates: [src('project', proj.id, proj.name), ...ctx.candidates],
    isEmpty: false,
    emptyMessage: '',
  };
};

export const buildSprintSummary: ContextBuilder = async (supabase, m, params) => {
  if (!params.sprintId) return empty('No sprint specified.');
  const { data: sprint } = await supabase
    .from('sprints')
    .select('id, name, project_id, status')
    .eq('id', params.sprintId)
    .maybeSingle();
  if (!sprint) return empty('Sprint not found or not accessible.');

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, task_key, title, status')
    .eq('organization_id', m.organizationId)
    .eq('sprint_id', params.sprintId)
    .is('archived_at', null)
    .limit(100);
  const rows = tasks ?? [];
  const done = rows.filter((t) => t.status === 'DONE').length;
  const blocked = rows.filter((t) => t.status === 'BLOCKED');

  const facts =
    `Sprint: ${sprint.name} (${sprint.status}). Tasks: ${rows.length} total, ${done} done, ${blocked.length} blocked.\n` +
    rows.slice(0, 12).map((t) => `- ${t.task_key}: ${t.title} [${t.status}]`).join('\n');

  return {
    facts,
    candidates: blocked
      .slice(0, 10)
      .map((t) => src('task', t.id, `${t.task_key}: ${t.title}`)),
    isEmpty: false,
    emptyMessage: '',
  };
};

export const buildTaskSummary: ContextBuilder = async (supabase, m, params) => {
  if (!params.taskId) return empty('No task specified.');
  const { data: task } = await supabase
    .from('tasks')
    .select('id, task_key, title, description, status, due_date, is_blocked')
    .eq('id', params.taskId)
    .maybeSingle();
  if (!task) return empty('Task not found or not accessible.');

  const { data: comments } = await supabase
    .from('task_comments')
    .select('id, body, created_at')
    .eq('task_id', params.taskId)
    .order('created_at', { ascending: false })
    .limit(20);
  const cs = comments ?? [];

  const facts =
    `Task ${task.task_key}: ${task.title} [status=${task.status}${task.due_date ? `, due=${task.due_date}` : ''}${task.is_blocked ? ', blocked' : ''}].\n` +
    (task.description ? `Description: ${String(task.description).slice(0, 800)}\n` : '') +
    (cs.length
      ? `Recent comments (${cs.length}):\n${cs.slice(0, 10).map((c) => `- ${String(c.body).slice(0, 200)}`).join('\n')}`
      : 'No comments yet.');

  return {
    facts,
    candidates: [src('task', task.id, `${task.task_key}: ${task.title}`)],
    isEmpty: false,
    emptyMessage: '',
  };
};

export const buildCommentSummary: ContextBuilder = async (supabase, m, params) => {
  if (!params.taskId) return empty('No task specified.');
  const { data: task } = await supabase
    .from('tasks')
    .select('id, task_key, title')
    .eq('id', params.taskId)
    .maybeSingle();
  if (!task) return empty('Task not found or not accessible.');
  const { data: comments } = await supabase
    .from('task_comments')
    .select('id, body, created_at')
    .eq('task_id', params.taskId)
    .order('created_at', { ascending: false })
    .limit(50);
  const cs = comments ?? [];
  if (cs.length === 0) return empty('This task has no comments to summarize.');

  return {
    facts:
      `Comment thread on ${task.task_key}: ${task.title} (${cs.length} comments, newest first):\n` +
      cs.map((c) => `- ${String(c.body).slice(0, 240)}`).join('\n'),
    candidates: [src('task', task.id, `${task.task_key}: ${task.title}`)],
    isEmpty: false,
    emptyMessage: '',
  };
};

export const buildIncidentSummary: ContextBuilder = async (supabase, m, params) => {
  if (!params.incidentId) return empty('No incident specified.');
  const { data: inc } = await supabase
    .from('incidents')
    .select('id, title, severity, status, summary, resolved_at')
    .eq('id', params.incidentId)
    .maybeSingle();
  if (!inc) return empty('Incident not found or not accessible.');

  const { data: events } = await supabase
    .from('incident_timeline_events')
    .select('id, note, created_at')
    .eq('incident_id', params.incidentId)
    .order('created_at', { ascending: true })
    .limit(40);
  const ev = events ?? [];

  const facts =
    `Incident: ${inc.title} [severity=${inc.severity}, status=${inc.status}${inc.resolved_at ? ', resolved' : ', active'}].\n` +
    (inc.summary ? `Summary: ${String(inc.summary).slice(0, 600)}\n` : '') +
    (ev.length
      ? `Timeline:\n${ev.map((e) => `- ${String(e.note).slice(0, 200)}`).join('\n')}`
      : 'No timeline events recorded.');

  return {
    facts,
    candidates: [src('incident', inc.id, `${inc.severity}: ${inc.title}`)],
    isEmpty: false,
    emptyMessage: '',
  };
};

export const buildReleaseSummary: ContextBuilder = async (supabase, m, params) => {
  if (!params.releaseId) return empty('No release specified.');
  const { data: rel } = await supabase
    .from('releases')
    .select('id, name, version, status, notes')
    .eq('id', params.releaseId)
    .maybeSingle();
  if (!rel) return empty('Release not found or not accessible.');

  const { data: appr } = await supabase
    .from('approval_requests')
    .select('id, approval_type, status')
    .eq('release_id', params.releaseId)
    .limit(20);
  const approvals = appr ?? [];

  const facts =
    `Release: ${rel.name} ${rel.version} [status=${rel.status}].\n` +
    (rel.notes ? `Notes: ${String(rel.notes).slice(0, 600)}\n` : '') +
    (approvals.length
      ? `Approvals: ${approvals.map((a) => `${a.approval_type}=${a.status}`).join(', ')}`
      : 'No approval requests recorded.');

  return {
    facts,
    candidates: [
      src('release', rel.id, `${rel.name} ${rel.version}`),
      ...approvals
        .filter((a) => a.status === 'PENDING')
        .slice(0, 4)
        .map((a) => src('approval_request', a.id, `${a.approval_type} approval`)),
    ],
    isEmpty: false,
    emptyMessage: '',
  };
};
