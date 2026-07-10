import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_PERSONAS } from '@/lib/demo/provision-demo-workspace';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  role: z.string(),
}).strict();

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

  return handle(async () => {
    const body = schema.parse(await req.json());
    const supabase = await createClient();

    // 1. Validate Anonymous User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.is_anonymous) {
      throw Errors.unauthenticated('Not a valid demo session.');
    }

    // Rate Limit: 20 switches per hour per demo session
    if (!(await checkRateLimit(`demo_switch_${user.id}`, 20, 3600))) {
      return NextResponse.json({ data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many role switches.' } }, { status: 429 });
    }

    const admin = createAdminClient();

    // 2. Validate Demo Session
    const { data: session, error: sessionError } = await admin
      .from('demo_sessions')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (sessionError || !session) {
      throw Errors.unauthenticated('Demo session is invalid or expired.');
    }

    // 3. Validate Requested Role
    if (!DEMO_PERSONAS.find(p => p.role === body.role)) {
      throw Errors.validation('Invalid demo role requested.');
    }

    // 4. Update role
    const { data: roleDef } = await admin
      .from('roles')
      .select('id')
      .eq('code', body.role)
      .is('organization_id', null)
      .single();

    if (!roleDef) throw Errors.internal('Role not found.');

    // We must update the active role in demo_sessions and the member_roles table
    await admin.from('demo_sessions').update({ active_demo_role: body.role }).eq('id', session.id);

    // Delete existing roles for the visitor member
    await admin.from('member_roles').delete().eq('organization_member_id', session.demo_member_id);

    // Insert new role
    await admin.from('member_roles').insert({
      organization_member_id: session.demo_member_id,
      role_id: roleDef.id,
    });

    return ok({ success: true });
  });
}
