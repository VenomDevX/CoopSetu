'use client';

import { QrCode, Camera, CreditCard, UserCheck, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

interface AttendanceFeedTableProps {
  records: FeedRecord[];
  compact?: boolean;
}

const METHOD_CONFIG: Record<string, { icon: typeof QrCode; color: string; bg: string }> = {
  RFID: { icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  QR: { icon: QrCode, color: 'text-green-500', bg: 'bg-green-500/10' },
  FACE: { icon: Camera, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  MANUAL: { icon: UserCheck, color: 'text-muted-foreground', bg: 'bg-muted' },
  TOTP: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
};

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'border-green-500/40 text-green-500',
  LATE: 'border-amber-500/40 text-amber-500',
  ABSENT: 'border-red-500/40 text-red-500',
  EXCUSED: 'border-blue-500/40 text-blue-500',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function AttendanceFeedTable({ records, compact = false }: AttendanceFeedTableProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex flex-col items-center gap-3">
        <QrCode className="w-8 h-8 text-muted-foreground/50" />
        No attendance records
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {records.map((rec) => {
          const method = METHOD_CONFIG[rec.method] || METHOD_CONFIG.MANUAL;
          const MethodIcon = method.icon;
          const statusStyle = STATUS_STYLE[rec.status] || STATUS_STYLE.ABSENT;

          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3 p-3 border border-border rounded hover:bg-surface-hover transition-colors"
            >
              {/* Method icon */}
              <div className={`w-8 h-8 rounded flex items-center justify-center ${method.bg} ${method.color}`}>
                <MethodIcon className="w-4 h-4" />
              </div>

              {/* Name & details */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono text-foreground truncate">
                  {rec.memberName}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase flex items-center gap-1 flex-wrap">
                  <span>{rec.method}</span>
                  <span>•</span>
                  <span>{formatTime(rec.markedAt)}</span>
                  {rec.deviceName && !compact && (
                    <>
                      <span>•</span>
                      <span>{rec.deviceName}</span>
                    </>
                  )}
                  {rec.batchName && !compact && (
                    <>
                      <span>•</span>
                      <span>{rec.batchName}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status chip */}
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${statusStyle}`}>
                {rec.status}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
