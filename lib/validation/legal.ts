import { z } from 'zod';

// .strict() rejects any client-supplied trust-sensitive field outright
// (user_id, accepted_at, document_id, ip, role, organization_id, etc.) --
// the server is the only source of truth for who/what/when was accepted.
export const acceptLegalSchema = z.object({
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  acceptedCookies: z.boolean().optional(),
  source: z.enum(['SIGNUP', 'OAUTH_CONSENT', 'INVITE', 'RE_ACCEPT']).default('SIGNUP'),
}).strict();
