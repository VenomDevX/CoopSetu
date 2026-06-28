import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  parent_comment_id: z.string().uuid().optional(),
  // organization_member_ids mentioned in the comment
  mentions: z.array(z.string().uuid()).max(50).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/** Remove control characters (except tab=9, newline=10, CR=13) and trim. */
export function sanitizeText(input: string): string {
  let out = '';
  for (const ch of input) {
    const c = ch.charCodeAt(0);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) continue;
    out += ch;
  }
  return out.trim();
}
