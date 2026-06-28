export const TASK_STATUSES = [
  'BACKLOG','READY','IN_PROGRESS','BLOCKED','CODE_REVIEW','QA_TESTING',
  'SECURITY_REVIEW','READY_FOR_RELEASE','DONE','CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TYPES = [
  'TASK','STORY','BUG','IMPROVEMENT','TECHNICAL_DEBT','SECURITY_TASK',
  'INCIDENT_FOLLOW_UP','RESEARCH','SPIKE','COMPLIANCE_TASK',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const PRIORITIES = ['LOW','MEDIUM','HIGH','CRITICAL'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SECURITY_CLASSIFICATIONS = ['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'] as const;
export type SecurityClassification = (typeof SECURITY_CLASSIFICATIONS)[number];

/** Statuses considered "done" for completion/overdue calculations. */
export const CLOSED_TASK_STATUSES: TaskStatus[] = ['DONE', 'CANCELLED'];
