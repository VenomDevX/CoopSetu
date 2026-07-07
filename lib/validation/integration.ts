import { z } from 'zod';

export const connectRepositorySchema = z.object({
  integration_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  provider: z.enum(['github', 'gitlab', 'bitbucket', 'azure_devops']).default('github'),
  default_branch: z.string().min(1).max(255).default('main'),
  url: z.string().url().optional(),
});

/**
 * Importing a specific GitHub repo the caller picked from the real
 * GET /api/v1/integrations/github/repos list. Server re-verifies
 * `github_repo_id` against GitHub before creating the repositories row —
 * see services/integration.service.ts's importGithubRepository.
 */
export const importGithubRepositorySchema = z.object({
  integration_id: z.string().uuid(),
  github_repo_id: z.number(),
  full_name: z.string().min(1).max(255),
  default_branch: z.string().min(1).max(255),
  html_url: z.string().url(),
});
