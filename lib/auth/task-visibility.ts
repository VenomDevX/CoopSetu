import type { TaskAssignmentType, TaskVisibilityScope } from '@/lib/constants/task-statuses';

export interface TaskVisibilityMember {
  member_id: string;
  revoked_at?: string | null;
}

export interface TaskAssignmentVisibility {
  organization_member_id: string;
  assignment_type?: TaskAssignmentType | string | null;
  assigned_by_member_id?: string | null;
  assigned_by?: string | null;
  removed_at?: string | null;
  member_manager_id?: string | null;
}

export interface TaskVisibilityRecord {
  organization_id: string;
  project_id: string;
  reporter_member_id?: string | null;
  primary_assignee_member_id?: string | null;
  primary_assignee_manager_id?: string | null;
  visibility_scope?: TaskVisibilityScope | string | null;
  assignments?: TaskAssignmentVisibility[];
  visibility_members?: TaskVisibilityMember[];
}

export interface TaskVisibilityContext {
  memberId: string;
  roles: string[];
  permissions: string[];
  canViewProject?: boolean;
  isProjectResponsibleManager?: boolean;
  managedMemberIds?: string[];
}

const FULL_ACCESS_ROLES = new Set(['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_OWNER']);

export function hasTaskPermission(ctx: TaskVisibilityContext, permission: string): boolean {
  return ctx.roles.some((role) => FULL_ACCESS_ROLES.has(role)) || ctx.permissions.includes(permission);
}

export function isActiveAssignment(a: TaskAssignmentVisibility): boolean {
  return !a.removed_at;
}

export function canViewTask(ctx: TaskVisibilityContext, task: TaskVisibilityRecord): boolean {
  if (!hasTaskPermission(ctx, 'task:view')) return false;
  if (ctx.roles.some((role) => FULL_ACCESS_ROLES.has(role))) return true;

  const scope = task.visibility_scope ?? 'PRIVATE_ASSIGNMENT';
  if (scope === 'ORGANIZATION_VISIBLE') return true;
  if (scope === 'PROJECT_SHARED' && ctx.canViewProject) return true;

  if (task.reporter_member_id === ctx.memberId) return true;
  if (task.primary_assignee_member_id === ctx.memberId) return true;
  if (ctx.isProjectResponsibleManager) return true;

  const assignments = task.assignments ?? [];
  if (assignments.some((a) => isActiveAssignment(a) && a.organization_member_id === ctx.memberId)) {
    return true;
  }
  if (assignments.some((a) => (a.assigned_by_member_id ?? a.assigned_by) === ctx.memberId)) {
    return true;
  }
  if ((task.visibility_members ?? []).some((m) => !m.revoked_at && m.member_id === ctx.memberId)) {
    return true;
  }

  if (!hasTaskPermission(ctx, 'task:view_team_assignments')) return false;
  const managed = new Set(ctx.managedMemberIds ?? []);
  if (task.primary_assignee_member_id && managed.has(task.primary_assignee_member_id)) return true;
  return assignments.some((a) => isActiveAssignment(a) && managed.has(a.organization_member_id));
}

export function canEditTask(ctx: TaskVisibilityContext, task: TaskVisibilityRecord): boolean {
  if (!canViewTask(ctx, task) || !hasTaskPermission(ctx, 'task:update')) return false;
  if (ctx.roles.some((role) => FULL_ACCESS_ROLES.has(role))) return true;
  if (ctx.isProjectResponsibleManager) return true;
  if (task.reporter_member_id === ctx.memberId || task.primary_assignee_member_id === ctx.memberId) return true;
  return (task.assignments ?? []).some((a) => isActiveAssignment(a) && a.organization_member_id === ctx.memberId);
}

export function canAssignTask(ctx: TaskVisibilityContext, task: TaskVisibilityRecord): boolean {
  if (!canViewTask(ctx, task) || !hasTaskPermission(ctx, 'task:assign')) return false;
  if (ctx.roles.some((role) => FULL_ACCESS_ROLES.has(role))) return true;
  if (ctx.isProjectResponsibleManager) return true;
  const managed = new Set(ctx.managedMemberIds ?? []);
  if (task.primary_assignee_member_id && managed.has(task.primary_assignee_member_id)) return true;
  return (task.assignments ?? []).some((a) => isActiveAssignment(a) && managed.has(a.organization_member_id));
}

export function canViewTaskAssignmentHistory(
  ctx: TaskVisibilityContext,
  task: TaskVisibilityRecord,
): boolean {
  return canViewTask(ctx, task);
}
