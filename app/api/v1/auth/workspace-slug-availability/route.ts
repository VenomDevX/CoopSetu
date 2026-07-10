import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { isReservedWorkspaceSlug } from '@/lib/auth/reserved-identifiers';
import { z } from 'zod';

const schema = z.object({
  slug: z.string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9\-]+$/)
    .refine(val => !val.startsWith('-') && !val.endsWith('-') && !val.includes('--'))
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    
    if (!(await checkRateLimit(ip, 10, 60))) {
      return NextResponse.json(
        { error: { message: 'Too many requests' } },
        { status: 429 }
      );
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ available: false });
    }

    const normalized = parsed.data.slug;

    if (isReservedWorkspaceSlug(normalized)) {
      return NextResponse.json({ available: false });
    }

    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', normalized)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking slug availability:', error);
      return NextResponse.json({ available: false }, { status: 500 });
    }

    return NextResponse.json({ available: !data });
  } catch (err) {
    console.error('Slug availability error:', err);
    return NextResponse.json({ available: false }, { status: 500 });
  }
}
