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
  'coopsetu',
  'coopsetu-admin',
  'coopsetu-support',
  // The pre-rename brand stays reserved on purpose: releasing it would let
  // someone register `handoff` and impersonate the project on old links,
  // screenshots and documentation. Do not remove with the rest of the rename.
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
  'coopsetu',
  'coopsetu-admin',
  'coopsetu-support',
  // Kept reserved after the rename — see RESERVED_WORKSPACE_SLUGS above.
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
