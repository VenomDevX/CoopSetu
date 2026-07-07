import { z } from 'zod';

export const createSoloWorkspaceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
});

export const updateSoloWorkspaceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
});

export const deleteSoloWorkspaceSchema = z.object({
  confirmation: z.string().min(1),
});

export const createStudentTeamSchema = z.object({
  name: z.string().min(2).max(120),
  eventName: z.string().max(120).optional(),
  shortDescription: z.string().max(500).optional(),
  expectedTeamSize: z.number().int().min(1).max(50).optional(),
  maxTeamSize: z.number().int().min(1).max(50),
  primaryTeamRole: z.string().max(60).optional(),
});

export const joinCodeSchema = z.object({
  code: z.string().min(4).max(40),
});

export const updateMemberRoleSchema = z.object({
  roleCode: z.enum(['STUDENT_CO_LEAD', 'STUDENT_MEMBER']),
});

export const updateMemberLabelsSchema = z.object({
  labels: z.array(z.string().trim().min(1).max(60)).max(10),
});

export const coLeadToggleSchema = z.object({
  enabled: z.boolean(),
});

export const transferLeadershipSchema = z.object({
  toMemberId: z.string().uuid(),
  demoteTo: z.enum(['STUDENT_CO_LEAD', 'STUDENT_MEMBER']).default('STUDENT_CO_LEAD'),
});

export type CreateSoloWorkspaceInput = z.infer<typeof createSoloWorkspaceSchema>;
export type CreateStudentTeamInput = z.infer<typeof createStudentTeamSchema>;
