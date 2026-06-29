import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { contactRequestSchema } from '@/lib/validation/contact';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

function hashValue(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const userAgent = req.headers.get('user-agent') || '';
  const ip = getClientIp(req);
  const ipHash = hashValue(ip);
  const userAgentHash = hashValue(userAgent);

  console.log(`[CONTACT_API] [${requestId}] Started request from IP: ${ipHash.substring(0, 10)}...`);

  try {
    // 1. Parse JSON body
    const body = await req.json();

    // 2. Validate input fields using Zod
    const validation = contactRequestSchema.safeParse(body);
    if (!validation.success) {
      console.warn(`[CONTACT_API] [${requestId}] Validation failed:`, validation.error.format());
      return NextResponse.json(
        { error: 'Invalid fields', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { fullName, workEmail, companyName, companySize, role, topic, message, honeypot } = validation.data;
    const normalizedEmail = workEmail.toLowerCase().trim();

    // 3. Honeypot check (Abuse protection)
    const honeypotTriggered = !!honeypot;
    if (honeypotTriggered) {
      console.warn(`[CONTACT_API] [${requestId}] Honeypot triggered. Silently capturing bot submission.`);
    }

    // 4. IP Rate Limit: 5 submissions per 15 minutes (900 seconds)
    // We pass the raw IP to the rate limiter (it checks/hashes/inserts inside rate_limits).
    const isIpAllowed = await checkRateLimit(ip, 5, 900);
    if (!isIpAllowed) {
      console.warn(`[CONTACT_API] [${requestId}] Rate limit exceeded for IP hash: ${ipHash.substring(0, 10)}...`);
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '900', // 15 minutes
          },
        }
      );
    }

    // 5. Supabase Client Setup (Server-only secret client)
    const supabase = createAdminClient();

    // 6. Email Rate Limit: 3 submissions per 24 hours (86400 seconds)
    // We count existing entries for this normalized email in the last 24 hours.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('contact_requests')
      .select('id', { count: 'exact', head: true })
      .eq('work_email', normalizedEmail)
      .eq('honeypot_triggered', false) // bots shouldn't exhaust real email limits
      .gte('created_at', oneDayAgo);

    if (countError) {
      console.error(`[CONTACT_API] [${requestId}] Error querying email count limit:`, countError);
    } else if (count !== null && count >= 3) {
      console.warn(`[CONTACT_API] [${requestId}] Rate limit exceeded for email: ${normalizedEmail}`);
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests for this email. Please try again tomorrow.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '86400', // 24 hours
          },
        }
      );
    }

    // 7. Insert message to Supabase contact_requests table
    const { error: insertError } = await supabase
      .from('contact_requests')
      .insert({
        full_name: fullName,
        work_email: normalizedEmail,
        company_name: companyName,
        company_size: companySize,
        role: role,
        topic: topic,
        message: message,
        status: 'pending',
        source: 'website',
        ip_hash: ipHash,
        user_agent_hash: userAgentHash,
        honeypot_triggered: honeypotTriggered,
        request_id: requestId,
      });

    if (insertError) {
      console.error(`[CONTACT_API] [${requestId}] Database insertion failed:`, insertError);
      return NextResponse.json(
        { error: 'Failed to submit request. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`[CONTACT_API] [${requestId}] Successfully saved contact request.`);

    // 8. Generic success response
    return NextResponse.json({
      success: true,
      message: 'Thank you. Your request has been received.',
    });

  } catch (err) {
    console.error(`[CONTACT_API] [${requestId}] Unexpected error:`, err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
