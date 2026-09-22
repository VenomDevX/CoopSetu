import { NextResponse } from 'next/server';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { createAdminClient } from '@/lib/supabase/admin';
import { istDayKey } from '@/lib/attendance/time';

/**
 * Device attendance analytics — session-auth only.
 *
 * Returns aggregated device attendance data for the caller's organization:
 *   - Breakdown by method (RFID, QR, Face)
 *   - Breakdown by device
 *   - Daily trend of device check-ins
 */
export async function GET() {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const orgId = membership.organizationId;

    // Method breakdown
    const { data: methodBreakdown } = await admin
      .from('device_attendance_events')
      .select('method')
      .eq('organization_id', orgId);

    const methodCounts: Record<string, number> = { RFID: 0, QR: 0, FACE: 0 };
    (methodBreakdown || []).forEach((r: any) => {
      methodCounts[r.method] = (methodCounts[r.method] || 0) + 1;
    });

    // Device breakdown
    const { data: deviceBreakdown } = await admin
      .from('device_attendance_events')
      .select(`
        device_id,
        device_tokens!inner ( label, device_name, location )
      `)
      .eq('organization_id', orgId);

    const deviceCounts: Record<string, { label: string; count: number }> = {};
    (deviceBreakdown || []).forEach((r: any) => {
      const id = r.device_id;
      if (!deviceCounts[id]) {
        const dt = r.device_tokens as any;
        deviceCounts[id] = {
          label: dt?.label || dt?.device_name || 'Unknown',
          count: 0,
        };
      }
      deviceCounts[id].count++;
    });

    // Daily trend (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: dailyEvents } = await admin
      .from('device_attendance_events')
      .select('marked_at')
      .eq('organization_id', orgId)
      .gte('marked_at', thirtyDaysAgo)
      .order('marked_at', { ascending: true });

    const dailyCounts: Record<string, number> = {};
    (dailyEvents || []).forEach((r: any) => {
      const day = istDayKey(r.marked_at);
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });
    const dailyTrend = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

    // Total
    const total = Object.values(methodCounts).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      data: {
        total,
        byMethod: [
          { method: 'RFID', count: methodCounts.RFID, color: '#7C5CFC' },
          { method: 'QR', count: methodCounts.QR, color: '#22C55E' },
          { method: 'Face', count: methodCounts.FACE, color: '#F59E0B' },
        ],
        byDevice: Object.values(deviceCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        dailyTrend,
      },
    });

  } catch (err: any) {
    console.error('Device attendance analytics error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
