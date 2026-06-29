import { z } from 'zod';

export const connectRepositorySchema = z.object({
  integration_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  provider: z.enum(['github', 'gitlab', 'bitbucket', 'azure_devops']).default('github'),
  default_branch: z.string().min(1).max(255).default('main'),
  url: z.string().url().optional(),
});
