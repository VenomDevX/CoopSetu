/** Canonical realtime channel names. Keep client + server in sync. */
export const channels = {
  organization: (orgId: string) => `organization:${orgId}`,
  project: (projectId: string) => `project:${projectId}`,
  task: (taskId: string) => `task:${taskId}`,
  user: (memberId: string) => `user:${memberId}`,
};
