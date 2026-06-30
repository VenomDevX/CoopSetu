'use client';

import { createContext, useContext } from 'react';

export interface MembershipContextValue {
  memberId: string;
  organizationId: string;
  organizationName: string;
  roles: string[];
  permissions: string[];
  isDemo?: boolean;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

export function MembershipProvider({
  value,
  children,
}: {
  value: MembershipContextValue;
  children: React.ReactNode;
}) {
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useCurrentMembership(): MembershipContextValue {
  const ctx = useContext(MembershipContext);
  if (!ctx) throw new Error('useCurrentMembership must be used within MembershipProvider');
  return ctx;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_OWNER', 'ORG_ADMIN'];

/**
 * Client-side permission check for UI gating. Mirrors the server rule: admins
 * implicitly hold every permission. NEVER the sole gate — APIs + RLS enforce.
 */
export function usePermission(): {
  has: (perm: string) => boolean;
  hasRole: (...codes: string[]) => boolean;
  isAdmin: boolean;
  roles: string[];
  isDemo: boolean;
} {
  const m = useContext(MembershipContext);
  const roles = m?.roles ?? [];
  const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
  return {
    has: (perm: string) => isAdmin || (m?.permissions.includes(perm) ?? false),
    hasRole: (...codes: string[]) => codes.some((c) => roles.includes(c)),
    isAdmin,
    roles,
    isDemo: !!m?.isDemo,
  };
}
