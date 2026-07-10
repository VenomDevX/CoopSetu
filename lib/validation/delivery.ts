import { z } from 'zod';

export const createSprintSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  goal: z.string().max(2000).optional(),
  team_id: z.string().uuid().optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  capacity_hours: z.number().nonnegative().optional(),
  planned_story_points: z.number().nonnegative().optional(),
}).strict();
export const updateSprintSchema = createSprintSchema.partial().omit({ project_id: true }).strict();

export const createReleaseSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  version: z.string().min(1).max(40),
  description: z.string().max(5000).optional(),
  release_manager_member_id: z.string().uuid().optional(),
  planned_release_at: z.string().datetime().optional(),
  requires_compliance_approval: z.boolean().optional(),
  rollback_plan: z.string().max(5000).optional(),
}).strict();
export const updateReleaseSchema = createReleaseSchema.partial().omit({ project_id: true }).extend({
  status: z.string().optional(),
  release_notes: z.string().max(20000).optional(),
}).strict();

export const decideReleaseApprovalSchema = z.object({
  approval_type: z.enum(['QA', 'SECURITY', 'COMPLIANCE', 'RELEASE_MANAGER']),
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(2000).optional(),
}).strict();

export const createApprovalRequestSchema = z.object({
  approval_type: z.string().min(1).max(60),
  project_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
  required_role: z.string().max(60).optional(),
  due_date: z.string().date().optional(),
}).strict();

export const decideApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(2000).optional(),
}).strict();

export const deployReleaseSchema = z.object({
  environment_id: z.string().uuid().optional(),
}).strict();
