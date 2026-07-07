import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { joinCodeSchema } from '@/lib/validation/student-team';
import { previewJoinCode } from '@/services/student-workspace.service';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!(await checkRateLimit(`joincode-preview:${ip}`, 5, 300))) {
      throw Errors.badRequest('Too many requests. Please try again later.');
    }

    const { code } = joinCodeSchema.parse(await req.json());

    try {
      const preview = await previewJoinCode(code);
      return ok(preview);
    } catch {
      // Never leak why a code is invalid (expired vs revoked vs never existed).
      throw Errors.notFound('Invalid or expired join code.');
    }
  });
}
