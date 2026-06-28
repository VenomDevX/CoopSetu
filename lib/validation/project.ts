import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(160),
  code: z.string().min(1).max(20).regex(/^[A-Z0-9]+$/, 'Use uppercase letters/numbers'),
  description: z.string().max(5000).optional(),
  business_objective: z.string().max(5000).optional(),
  scope: z.string().max(5000).optional(),
  portfolio_id: z.string().uuid().optional(),
  program_id: z.string().uuid().optional(),
  owner_member_id: z.string().uuid().optional(),
  project_manager_member_id: z.string().uuid().optional(),
  status: z.enum(['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED']).optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  security_classification: z.enum(['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED']).optional(),
  start_date: z.string().date().optional(),
  target_end_date: z.string().date().optional(),
  budget_amount: z.number().nonnegative().optional(),
  effort_estimate_hours: z.number().nonnegative().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  health: z.enum(['ON_TRACK','AT_RISK','OFF_TRACK']).optional(),
});

export const addProjectMemberSchema = z.object({
  organization_member_id: z.string().uuid(),
  project_role: z.string().max(80).optional(),
  can_view: z.boolean().optional(),
  can_comment: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  can_manage: z.boolean().optional(),
});

export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  due_date: z.string().date().optional(),
  owner_member_id: z.string().uuid().optional(),
  status: z.enum(['PLANNED','IN_PROGRESS','COMPLETED','MISSED']).optional(),
});

export const createRiskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  risk_level: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  probability: z.enum(['LOW','MEDIUM','HIGH']).optional(),
  impact: z.enum(['LOW','MEDIUM','HIGH']).optional(),
  status: z.enum(['OPEN','MITIGATING','CLOSED','ACCEPTED']).optional(),
  owner_member_id: z.string().uuid().optional(),
  mitigation_plan: z.string().max(2000).optional(),
  due_date: z.string().date().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
