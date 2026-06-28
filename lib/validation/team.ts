import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  head_member_id: z.string().uuid().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  department_id: z.string().uuid().optional(),
  team_lead_member_id: z.string().uuid().optional(),
  capacity_hours_per_week: z.number().min(0).max(10000).optional(),
});

export const updateTeamSchema = createTeamSchema.partial();

export const addTeamMemberSchema = z.object({
  organization_member_id: z.string().uuid(),
  role_in_team: z.string().max(80).optional(),
  allocation_percent: z.number().min(0).max(100).optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
