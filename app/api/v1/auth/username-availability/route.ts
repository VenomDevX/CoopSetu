import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { isReservedUsername } from '@/lib/auth/reserved-identifiers';
import { z } from 'zod';

const schema = z.object({
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9\._\-]+$/)
    .refine(val => !val.includes('..'))
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Rate limit username availability checks to prevent enumeration
    if (!(await checkRateLimit(ip, 10, 60))) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      // The frontend expects a 200 with { available: false } for syntax errors
      // (like too short, invalid chars), rather than a 400.
      return NextResponse.json({ available: false });
    }

    const normalized = parsed.data.username;

    if (isReservedUsername(normalized)) {
      return NextResponse.json({ available: false });
    }

    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username_normalized', normalized)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking username availability:', error);
      return NextResponse.json({ available: false }, { status: 500 });
    }

    return NextResponse.json({ available: !data });
  } catch (err) {
    console.error('Username availability error:', err);
    return NextResponse.json({ available: false }, { status: 500 });
  }
}
