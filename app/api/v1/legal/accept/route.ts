import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { getLegalStatus } from '@/lib/legal/get-legal-status';
import { acceptLegalSchema } from '@/lib/validation/legal';

function hashValue(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user, supabase } = await requireUser();
    const body = acceptLegalSchema.parse(await req.json());

    const status = await getLegalStatus(user, supabase);
    if (!status.termsDocumentId || !status.privacyDocumentId) {
      throw Errors.internal('No active legal documents are published.');
    }

    const requestId = crypto.randomUUID();
    const ipHash = hashValue(getClientIp(req));
    const userAgentHash = hashValue(req.headers.get('user-agent') || '');

    const { data, error } = await supabase.rpc('record_legal_acceptance', {
      p_terms_document_id: status.termsDocumentId,
      p_privacy_document_id: status.privacyDocumentId,
      p_cookies_document_id: body.acceptedCookies ? status.cookiesDocumentId : null,
      p_acceptance_source: body.source,
      p_request_id: requestId,
      p_ip_hash: ipHash,
      p_user_agent_hash: userAgentHash,
    });

    if (error) {
      throw Errors.internal(`Failed to record legal acceptance: ${error.message}`);
    }

    return ok({
      accepted: true,
      termsVersion: status.termsVersion,
      privacyVersion: status.privacyVersion,
    }, undefined, 201);
  });
}
