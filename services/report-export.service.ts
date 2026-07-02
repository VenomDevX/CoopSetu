import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { toCsv } from '@/lib/csv';

type ProjectHealth = 'On Track' | 'At Risk' | 'Off Track' | 'Completed';
type SprintStatus = 'Active' | 'Planning' | 'Completed';

const PROJECT_HEALTH: Record<string, ProjectHealth> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  OFF_TRACK: 'Off Track',
};
const SPRINT_STATUS: Record<string, SprintStatus> = {
  ACTIVE: 'Active',
  PLANNED: 'Planning',
  COMPLETED: 'Completed',
  CANCELLED: 'Completed',
};
const CLOSED_TASK_STATUSES = new Set(['DONE', 'CANCELLED']);

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function matchesSearch(row: Record<string, unknown>, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(needle));
}

async function recordExport(
  supabase: SupabaseClient,
  orgId: string,
  actorMemberId: string,
  exportType: string,
  fileName: string,
  filters: Record<string, unknown>,
  rowCount: number,
) {
  const { data, error } = await supabase
    .from('report_exports')
    .insert({
      organization_id: orgId,
      actor_member_id: actorMemberId,
      export_type: exportType,
      format: 'CSV',
      filters,
      status: 'COMPLETED',
      file_name: fileName,
      row_count: rowCount,
    })
    .select('id')
    .single();
  if (error) throw Errors.internal(error.message);

  await createAuditLog(supabase, {
    organizationId: orgId,
    actorMemberId,
    action: 'report.exported',
    entityType: 'report_export',
    entityId: data.id,
    afterState: { exportType, fileName, rowCount, filters },
  });
}

export async function exportProjectsCsv(
  supabase: SupabaseClient,
  orgId: string,
  actorMemberId: string,
  filters: { q?: string; health?: string },
) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, code, status, health, priority, security_classification, start_date, target_end_date, created_at, project_risks(count), milestones(count)')
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal(error.message);

  const rows = (data ?? []).map((project) => {
    const health = project.status === 'COMPLETED'
      ? 'Completed'
      : PROJECT_HEALTH[project.health] ?? 'On Track';
    return {
      code: project.code,
      name: project.name,
      status: project.status,
      health,
      priority: project.priority,
      security_classification: project.security_classification,
      start_date: project.start_date ?? '',
      target_end_date: project.target_end_date ?? '',
      open_risks: project.project_risks?.[0]?.count ?? 0,
      milestones: project.milestones?.[0]?.count ?? 0,
    };
  }).filter((row) => {
    const healthOk = !filters.health || filters.health === 'ALL' || row.health === filters.health;
    return healthOk && matchesSearch(row, filters.q ?? '');
  });

  const headers = [
    'code',
    'name',
    'status',
    'health',
    'priority',
    'security_classification',
    'start_date',
    'target_end_date',
    'open_risks',
    'milestones',
  ];
  const fileName = `handoff-project-report-${nowStamp()}.csv`;
  await recordExport(supabase, orgId, actorMemberId, 'PROJECT_REPORT', fileName, filters, rows.length);
  return { csv: toCsv(headers, rows), fileName, rowCount: rows.length };
}

export async function exportSprintsCsv(
  supabase: SupabaseClient,
  orgId: string,
  actorMemberId: string,
  filters: { q?: string; status?: string },
) {
  const { data: sprints, error } = await supabase
    .from('sprints')
    .select('id, name, goal, status, start_date, end_date, capacity_hours, planned_story_points, completed_story_points, project:project_id(code, name)')
    .eq('organization_id', orgId)
    .order('start_date', { ascending: false });
  if (error) throw Errors.internal(error.message);

  const sprintIds = (sprints ?? []).map((sprint) => sprint.id);
  const { data: tasks, error: tasksError } = sprintIds.length
    ? await supabase.from('tasks').select('sprint_id, status, story_points').eq('organization_id', orgId).in('sprint_id', sprintIds)
    : { data: [], error: null };
  if (tasksError) throw Errors.internal(tasksError.message);

  const taskCounts = new Map<string, { total: number; done: number; blocked: number; points: number }>();
  for (const task of tasks ?? []) {
    const current = taskCounts.get(task.sprint_id) ?? { total: 0, done: 0, blocked: 0, points: 0 };
    current.total += 1;
    if (CLOSED_TASK_STATUSES.has(task.status)) current.done += 1;
    if (task.status === 'BLOCKED') current.blocked += 1;
    current.points += Number(task.story_points) || 0;
    taskCounts.set(task.sprint_id, current);
  }

  const rows = (sprints ?? []).map((sprint) => {
    const status = SPRINT_STATUS[sprint.status] ?? 'Planning';
    const planned = Number(sprint.planned_story_points) || 0;
    const completed = Number(sprint.completed_story_points) || 0;
    const counts = taskCounts.get(sprint.id) ?? { total: 0, done: 0, blocked: 0, points: 0 };
    const project = Array.isArray(sprint.project) ? sprint.project[0] : sprint.project;
    return {
      project_code: project?.code ?? '',
      project_name: project?.name ?? '',
      sprint_name: sprint.name,
      goal: sprint.goal ?? '',
      status,
      start_date: sprint.start_date ?? '',
      end_date: sprint.end_date ?? '',
      capacity_hours: Number(sprint.capacity_hours) || 0,
      planned_story_points: planned,
      completed_story_points: completed,
      completion_percent: planned > 0 ? Math.round((completed / planned) * 100) : 0,
      total_tasks: counts.total,
      done_tasks: counts.done,
      blocked_tasks: counts.blocked,
      task_story_points: counts.points,
    };
  }).filter((row) => {
    const statusOk = !filters.status || filters.status === 'ALL' || row.status === filters.status;
    return statusOk && matchesSearch(row, filters.q ?? '');
  });

  const headers = [
    'project_code',
    'project_name',
    'sprint_name',
    'goal',
    'status',
    'start_date',
    'end_date',
    'capacity_hours',
    'planned_story_points',
    'completed_story_points',
    'completion_percent',
    'total_tasks',
    'done_tasks',
    'blocked_tasks',
    'task_story_points',
  ];
  const fileName = `handoff-sprint-report-${nowStamp()}.csv`;
  await recordExport(supabase, orgId, actorMemberId, 'SPRINT_REPORT', fileName, filters, rows.length);
  return { csv: toCsv(headers, rows), fileName, rowCount: rows.length };
}

export async function exportGlobalAnalytics(
  supabase: SupabaseClient,
  orgId: string,
  actorMemberId: string,
  format: 'csv' | 'pdf'
) {
  // 1. Gather high-level metrics
  const [projRes, sprintRes, taskRes] = await Promise.all([
    supabase.from('projects').select('id, status').eq('organization_id', orgId),
    supabase.from('sprints').select('id, status').eq('organization_id', orgId),
    supabase.from('tasks').select('id, status').eq('organization_id', orgId)
  ]);

  if (projRes.error) throw Errors.internal(projRes.error.message);
  if (sprintRes.error) throw Errors.internal(sprintRes.error.message);
  if (taskRes.error) throw Errors.internal(taskRes.error.message);

  const projects = projRes.data || [];
  const sprints = sprintRes.data || [];
  const tasks = taskRes.data || [];

  const metrics = [
    { Metric: 'Total Projects', Value: projects.length },
    { Metric: 'Active Projects', Value: projects.filter(p => p.status === 'ACTIVE').length },
    { Metric: 'Total Sprints', Value: sprints.length },
    { Metric: 'Total Tasks', Value: tasks.length },
    { Metric: 'Completed Tasks', Value: tasks.filter(t => t.status === 'DONE').length },
  ];

  const fileName = `handoff-global-analytics-${nowStamp()}.${format}`;
  await recordExport(supabase, orgId, actorMemberId, 'GLOBAL_ANALYTICS', fileName, {}, metrics.length);

  if (format === 'csv') {
    const csv = toCsv(['Metric', 'Value'], metrics);
    return { data: Buffer.from(csv), fileName, contentType: 'text/csv; charset=utf-8' };
  } else {
    // Import pdfkit dynamically to avoid server-side issues if not strictly needed
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    const p = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    doc.fontSize(24).text('HANDOFF Global Analytics Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown(3);

    doc.fontSize(16).text('Key Metrics:', { underline: true });
    doc.moveDown();

    metrics.forEach(m => {
      doc.fontSize(14).font('Helvetica').text(`${m.Metric}: `, { continued: true }).font('Helvetica-Bold').text(`${m.Value}`);
      doc.moveDown(0.5);
    });

    doc.end();
    const pdfBuffer = await p;
    return { data: pdfBuffer, fileName, contentType: 'application/pdf' };
  }
}

