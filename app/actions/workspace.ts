'use server';

import { cookies } from 'next/headers';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/get-current-membership';

export async function setActiveWorkspace(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });
}
