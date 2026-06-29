export type DashboardPersona = 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MANAGER' | 'EMPLOYEE';

/**
 * Resolves the primary dashboard persona for UI layout selection based on roles.
 * Priority: ORG_OWNER / ORG_ADMIN > PROJECT_MANAGER > TEAM_MANAGER > EMPLOYEE.
 *
 * NOTE: This is for presentation routing only. It does NOT bypass explicit data authorization.
 */
export function resolveDashboardPersona(roles: string[]): DashboardPersona {
  if (roles.includes('ORG_OWNER') || roles.includes('ORG_ADMIN') || roles.includes('SUPER_ADMIN')) {
    return 'ADMIN';
  }
  if (roles.includes('PROJECT_MANAGER')) {
    return 'PROJECT_MANAGER';
  }
  if (roles.includes('TEAM_MANAGER') || roles.includes('ENGINEERING_MANAGER') || roles.includes('QA_MANAGER') || roles.includes('TEAM_LEAD')) {
    return 'TEAM_MANAGER';
  }
  return 'EMPLOYEE';
}
