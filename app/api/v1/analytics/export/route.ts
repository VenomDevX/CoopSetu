import { NextResponse } from 'next/server';
import { handle } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { Errors } from '@/lib/api/errors';
import { exportGlobalAnalytics } from '@/services/report-export.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'report:export');

    const sp = new URL(req.url).searchParams;
    const rawFormat = sp.get('format') ?? 'csv';
    if (rawFormat !== 'csv' && rawFormat !== 'pdf') {
      throw Errors.validation('Invalid format. Must be csv or pdf.');
    }
    const format = rawFormat as 'csv' | 'pdf';

    const result = await exportGlobalAnalytics(supabase, m.organizationId, m.memberId, format);
    
    return new NextResponse(result.data as any, {
      headers: {
        'content-type': result.contentType,
        'content-disposition': `attachment; filename="${result.fileName}"`,
      },
    });
  });
}
