import { z } from 'zod';

export const createProjectDeadlineSchema = z.object({
  project_id: z.string().uuid(),
  sprint_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  due_date: z.string().date(),
  owner_member_id: z.string().uuid().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED']).optional(),
}).strict();

export const projectImportMappingSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  start_date: z.string().optional(),
  target_end_date: z.string().optional(),
}).strict();

export const exportFormatSchema = z.enum(['csv', 'pdf']).default('csv');

export type CreateProjectDeadlineInput = z.infer<typeof createProjectDeadlineSchema>;
export type ProjectImportMapping = z.infer<typeof projectImportMappingSchema>;
