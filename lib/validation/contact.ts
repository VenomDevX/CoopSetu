import { z } from 'zod';

export const companySizeEnum = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;
export const topicEnum = ['Request a Demo', 'Enterprise Sales', 'Product Question', 'Security Question', 'Partnership', 'Technical Support', 'Other'] as const;

export const contactRequestSchema = z.object({
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  workEmail: z.string()
    .email('Invalid email address')
    .max(255, 'Email is too long')
    .toLowerCase()
    .trim(),
  companyName: z.string()
    .min(2, 'Company name must be at least 2 characters')
    .max(120, 'Company name cannot exceed 120 characters')
    .trim(),
  companySize: z.enum(companySizeEnum, {
    message: 'Invalid company size',
  }),
  role: z.string()
    .min(2, 'Role must be at least 2 characters')
    .max(100, 'Role cannot exceed 100 characters')
    .trim(),
  topic: z.enum(topicEnum, {
    message: 'Invalid topic',
  }),
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(3000, 'Message cannot exceed 3000 characters')
    .trim(),
  honeypot: z.string().optional(),
}).strict();

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
