import { z } from 'zod';

export const declareIncidentSchema = z.object({
  title: z.string().min(5).max(100),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']).default('SEV3'),
  project_id: z.string().uuid().optional(),
  customer_impact: z.string().max(1000).optional(),
}).strict();

export const createPostmortemSchema = z.object({
  summary: z.string().min(10).max(2000),
  root_cause: z.string().max(2000).optional(),
  resolution: z.string().max(2000).optional(),
}).strict();
