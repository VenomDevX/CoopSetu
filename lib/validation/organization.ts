import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  industry: z.string().max(120).optional(),
  timezone: z.string().max(60).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  industry: z.string().max(120).optional(),
  timezone: z.string().max(60).optional(),
  theme_preference: z.enum(['light', 'dark', 'system']).optional(),
  ip_allowlist: z.array(z.string()).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
