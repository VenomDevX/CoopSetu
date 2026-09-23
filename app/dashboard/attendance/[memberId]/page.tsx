'use client';

import { useParams } from 'next/navigation';
import { PersonAttendanceView } from '@/components/attendance/person-attendance-view';

export default function AttendancePersonPage() {
  const params = useParams<{ memberId: string }>();
  return <PersonAttendanceView memberId={params.memberId} />;
}
