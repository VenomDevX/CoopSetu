/**
 * Single source of truth for grouping raw notification `type` values into the
 * Inbox's category rail. The server computes per-category counts and the client
 * filters the visible list with the *same* mapping, so badges, the ALL/UNREAD/
 * MENTIONS counts, and the rendered list can never contradict each other.
 */
export type NotificationCategory =
  | 'mentions' | 'approvals' | 'task_updates' | 'pull_requests'
  | 'release_alerts' | 'incident_alerts' | 'qa_security' | 'ai' | 'system';

export function categoryOf(type: string | null | undefined): NotificationCategory {
  const t = (type ?? '').toUpperCase();
  if (t.includes('MENTION') || t.includes('COMMENT')) return 'mentions';
  if (t.includes('APPROVAL')) return 'approvals';
  if (t.includes('RELEASE')) return 'release_alerts';
  if (t.includes('INCIDENT')) return 'incident_alerts';
  if (t.includes('SECURITY') || t.includes('QA') || t.includes('VULN')) return 'qa_security';
  if (t.includes('BUILD') || t.includes('PR') || t.includes('PIPELINE') || t.includes('DEPLOY')) return 'pull_requests';
  if (t.includes('AI') || t.includes('RECOMMENDATION')) return 'ai';
  if (t.startsWith('TASK')) return 'task_updates';
  return 'system';
}

/** Order + labels for the Inbox category rail. */
export const NOTIFICATION_CATEGORIES: { key: NotificationCategory; label: string }[] = [
  { key: 'mentions', label: 'Mentions' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'task_updates', label: 'Task Updates' },
  { key: 'pull_requests', label: 'Pull Requests' },
  { key: 'release_alerts', label: 'Release Alerts' },
  { key: 'incident_alerts', label: 'Incident Alerts' },
  { key: 'qa_security', label: 'QA & Security' },
  { key: 'ai', label: 'AI Recommendations' },
  { key: 'system', label: 'System Notifications' },
];

export type NotificationCounts = {
  all: number;
  unread: number;
} & Record<NotificationCategory, number>;
