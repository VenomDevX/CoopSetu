export const RESERVED_WORKSPACE_SLUGS = new Set([
  'admin',
  'administrator',
  'api',
  'auth',
  'login',
  'logout',
  'signup',
  'forgot-password',
  'reset-password',
  'support',
  'help',
  'docs',
  'dashboard',
  'settings',
  'status',
  'app',
  'www',
  'mail',
  'system',
  'root',
  'null',
  'undefined',
  'handoff',
  'handoff-admin',
  'handoff-support',
  'official'
]);

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'security',
  'official',
  'handoff',
  'handoff-admin',
  'handoff-support',
  'api',
  'null',
  'undefined'
]);

export function isReservedWorkspaceSlug(slug: string): boolean {
  return RESERVED_WORKSPACE_SLUGS.has(slug.toLowerCase().trim());
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase().trim());
}
