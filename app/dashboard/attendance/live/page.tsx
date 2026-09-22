'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Clock, CheckCircle2, AlertTriangle, Cpu, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { AttendanceFeedTable } from '@/components/attendance/attendance-feed-table';
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';

interface FeedRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar: string | null;
  method: string;
  status: string;
  markedAt: string;
  source: string;
  sessionType: string | null;
  batchName: string | null;
  courseTitle: string | null;
  deviceName: string | null;
  deviceLocation: string | null;
}

export default function LiveAttendancePage() {
  const t = useTranslations('Attendance');
  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [absent, setAbsent] = useState(0);
  const [onlineDevices, setOnlineDevices] = useState(0);
  const [clock, setClock] = useState('');

  const fetchFeed = useCallback(async () => {
    try {
      const [res, analyticsResponse, devicesResponse] = await Promise.all([
        fetch('/api/v1/attendance/feed?limit=100'),
        fetch('/api/v1/analytics/attendance?days=1'),
        fetch('/api/v1/devices'),
      ]);
      const [json, analytics, devices] = await Promise.all([
        res.json(), analyticsResponse.json(), devicesResponse.json(),
      ]);
      if (json?.data?.records) {
        setRecords(json.data.records);
      }
      setAbsent(analytics?.data?.summary?.totalAbsent || 0);
      setOnlineDevices((devices?.devices || []).filter((device: { is_online?: boolean }) => device.is_online).length);
    } catch (e) {
      console.error('Failed to fetch feed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchFeed, 0);
    return () => clearTimeout(timer);
  }, [fetchFeed]);

  // Realtime updates
  useAttendanceRealtime(fetchFeed);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stats
  const present = records.filter(r => r.status === 'PRESENT').length;
  const late = records.filter(r => r.status === 'LATE').length;
  const kpis = [
    { label: 'Checked In', value: present + late, icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Late', value: late, icon: Clock, color: 'text-amber-500' },
    { label: 'Absent', value: absent, icon: Users, color: 'text-red-500' },
    { label: 'Devices Online', value: onlineDevices, icon: Cpu, color: 'text-purple-500' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6"
      >
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
            <div className="w-2 h-2 bg-green-500 animate-pulse rounded" />
            Training_ERP // Live Attendance Monitor
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">
            Live Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono">
            Real-time attendance feed — {clock || 'IST'}
          </p>
        </div>
        <Button variant="outline" className="rounded font-mono text-xs uppercase" onClick={fetchFeed}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </motion.div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <Card className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between text-muted-foreground mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest">{kpi.label}</span>
                  <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">
                    <kpi.icon className="w-5 h-5" />
                  </div>
                </div>
                <div className={`text-3xl font-bold tracking-tighter ${kpi.color}`}>
                  {kpi.value}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Live Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm uppercase tracking-widest text-foreground">
            Recent Check-ins
          </h2>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3 h-3 text-green-500 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Live</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground font-mono text-xs">Loading...</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
            <AttendanceFeedTable records={records} />
          </div>
        )}
      </div>
    </div>
  );
}
