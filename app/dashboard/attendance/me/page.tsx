import { redirect } from 'next/navigation';
import { getCurrentMembership } from '@/lib/auth/get-current-membership';
import { PersonAttendanceView } from '@/components/attendance/person-attendance-view';

/**
 * The signed-in user's own attendance — the same live view staff get at
 * /dashboard/attendance/[memberId], resolved to the caller's membership so
 * every persona can reach it from the sidebar without knowing their member id.
 * Reads go through the per-person API, where RLS's attendance_records_self_read
 * already lets any member see their own rows.
 */
export default async function MyAttendancePage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect('/dashboard');
  return <PersonAttendanceView memberId={membership.memberId} eyebrow="Attendance / Me" />;
}
