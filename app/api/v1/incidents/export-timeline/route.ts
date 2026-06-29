import { NextResponse } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { Errors } from '@/lib/api/errors';

export async function GET() {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();

    // Fetch all timeline events for incidents in this org
    const { data: incidents, error: incError } = await supabase
      .from('incidents')
      .select('id, title')
      .eq('organization_id', m.organizationId);

    if (incError) throw Errors.internal(incError.message);
    
    if (!incidents || incidents.length === 0) {
       return new NextResponse('Incident ID,Incident Title,Event Type,Message,Created At\n', {
         headers: {
           'Content-Type': 'text/csv',
           'Content-Disposition': 'attachment; filename="timeline_export.csv"',
         },
       });
    }

    const incidentIds = incidents.map(i => i.id);

    const { data: events, error } = await supabase
      .from('incident_timeline_events')
      .select('*, incidents(title)')
      .in('incident_id', incidentIds)
      .order('created_at', { ascending: false });

    if (error) throw Errors.internal(error.message);

    const headers = ['Incident ID', 'Incident Title', 'Event Type', 'Message', 'Created At'];
    const rows = (events || []).map(evt => [
      evt.incident_id,
      evt.incidents?.title || 'Unknown',
      evt.event_type,
      `"${(evt.message || '').replace(/"/g, '""')}"`,
      evt.created_at
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="timeline_export.csv"',
      },
    });
  });
}
