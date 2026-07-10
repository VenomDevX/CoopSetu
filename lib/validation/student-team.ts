import { z } from 'zod';

export const createSoloWorkspaceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
}).strict();

export const updateSoloWorkspaceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
}).strict();

export const deleteSoloWorkspaceSchema = z.object({
  confirmation: z.string().min(1),
}).strict();

export const createStudentTeamSchema = z.object({
  name: z.string().min(2).max(120),
  eventName: z.string().max(120).optional(),
  shortDescription: z.string().max(500).optional(),
  expectedTeamSize: z.number().int().min(1).max(50).optional(),
  maxTeamSize: z.number().int().min(1).max(50),
  primaryTeamRole: z.string().max(60).optional(),
}).strict();

export const joinCodeSchema = z.object({
  code: z.string().min(4).max(40),
}).strict();

export const updateMemberRoleSchema = z.object({
  roleCode: z.enum(['STUDENT_CO_LEAD', 'STUDENT_MEMBER']),
}).strict();

export const updateMemberLabelsSchema = z.object({
  labels: z.array(z.string().trim().min(1).max(60)).max(10),
}).strict();

export const coLeadToggleSchema = z.object({
  enabled: z.boolean(),
}).strict();

export const transferLeadershipSchema = z.object({
  toMemberId: z.string().uuid(),
  demoteTo: z.enum(['STUDENT_CO_LEAD', 'STUDENT_MEMBER']).default('STUDENT_CO_LEAD'),
}).strict();

export type CreateSoloWorkspaceInput = z.infer<typeof createSoloWorkspaceSchema>;
export type CreateStudentTeamInput = z.infer<typeof createStudentTeamSchema>;
