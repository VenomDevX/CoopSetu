import { z } from 'zod';
import {
  TASK_ASSIGNMENT_TYPES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_VISIBILITY_SCOPES,
  PRIORITIES,
  SECURITY_CLASSIFICATIONS,
} from '@/lib/constants/task-statuses';

export const createTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
  task_type: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  security_classification: z.enum(SECURITY_CLASSIFICATIONS).optional(),
  visibility_scope: z.enum(TASK_VISIBILITY_SCOPES).optional(),
  epic_id: z.string().uuid().optional(),
  sprint_id: z.string().uuid().optional(),
  primary_assignee_member_id: z.string().uuid().optional(),
  due_date: z.string().date().optional(),
  start_date: z.string().date().optional(),
  estimated_hours: z.number().nonnegative().optional(),
  story_points: z.number().nonnegative().optional(),
  acceptance_criteria: z.string().max(10000).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20000).optional(),
  task_type: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  security_classification: z.enum(SECURITY_CLASSIFICATIONS).optional(),
  visibility_scope: z.enum(TASK_VISIBILITY_SCOPES).optional(),
  epic_id: z.string().uuid().nullable().optional(),
  sprint_id: z.string().uuid().nullable().optional(),
  primary_assignee_member_id: z.string().uuid().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  estimated_hours: z.number().nonnegative().nullable().optional(),
  actual_hours: z.number().nonnegative().optional(),
  story_points: z.number().nonnegative().nullable().optional(),
  acceptance_criteria: z.string().max(10000).optional(),
  is_blocked: z.boolean().optional(),
  blocker_reason: z.string().max(1000).nullable().optional(),
  position: z.number().optional(),
});

export const bulkUpdateSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(200),
  patch: updateTaskSchema,
});

export const addAssigneeSchema = z.object({
  organization_member_id: z.string().uuid(),
  assignment_role: z.string().max(40).optional(),
  assignment_type: z.enum(TASK_ASSIGNMENT_TYPES).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
