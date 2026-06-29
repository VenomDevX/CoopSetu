import { NextResponse } from 'next/server';
import { handle } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { Errors } from '@/lib/api/errors';
import { exportFormatSchema } from '@/lib/validation/group-a-actions';
import { exportProjectsCsv } from '@/services/report-export.service';

export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'report:export');

    const sp = new URL(req.url).searchParams;
    const format = exportFormatSchema.parse(sp.get('format') ?? 'csv');
    if (format === 'pdf') {
      throw Errors.validation('PDF export is not configured for project reports yet. Choose CSV.');
    }

    const result = await exportProjectsCsv(supabase, m.organizationId, m.memberId, {
      q: sp.get('q') ?? '',
      health: sp.get('health') ?? 'ALL',
    });
    return new NextResponse(result.csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${result.fileName}"`,
        'x-row-count': String(result.rowCount),
      },
    });
  });
}
