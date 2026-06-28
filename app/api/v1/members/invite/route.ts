import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { ROLE_CODES } from '@/lib/constants/roles';

// Invitees may not be granted owner/super-admin via invite.
const INVITABLE = ROLE_CODES.filter((r) => r !== 'SUPER_ADMIN' && r !== 'ORG_OWNER');

const schema = z.object({
  email: z.string().email(),
  role_code: z.enum(INVITABLE as [string, ...string[]]),
});

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'member:invite');
    const { data, error } = await supabase
      .from('organization_invites')
      .select('id, email, role_code, status, token, expires_at, created_at')
      .eq('organization_id', m.organizationId)
      .order('created_at', { ascending: false });
    if (error) throw Errors.internal(error.message);
    return ok(data);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'member:invite');
    const body = schema.parse(await req.json());

    const { data, error } = await supabase
      .from('organization_invites')
      .insert({
        organization_id: m.organizationId,
        email: body.email,
        role_code: body.role_code,
        invited_by: m.memberId,
      })
      .select('id, email, role_code, token, expires_at')
      .single();
    if (error) {
      if (error.code === '23505') throw Errors.conflict('That email already has a pending invite.');
      throw Errors.internal(error.message);
    }

    await createAuditLog(supabase, {
      organizationId: m.organizationId, action: 'member.invited', resourceType: 'organization_invite',
      resourceId: data.id, metadata: { email: body.email, role: body.role_code },
    });

    // Local dev: no email provider — return the accept link for manual sharing.
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return ok({ ...data, accept_url: `${base}/invite/${data.token}` }, undefined, 201);
  });
}
