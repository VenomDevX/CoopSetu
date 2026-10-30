import { describe, it, expect } from 'vitest';
import { isPublic } from '@/lib/supabase/middleware';

/**
 * Phase 7: restoring app/contact/page.tsx's real form is pointless if
 * anonymous submissions still 401 before reaching app/api/v1/contact/route.ts
 * (which itself has no auth check — it's meant to be public). isPublic() is
 * the only gate that matters here (lib/supabase/middleware.ts's
 * updateSession rejects unauthenticated /api/v1/* requests unless isPublic
 * says otherwise).
 */
describe('isPublic() — /api/v1/* unauthenticated access gate', () => {
  it('allows the contact form endpoint', () => {
    expect(isPublic('/api/v1/contact')).toBe(true);
  });

  it('still allows public certificate verification (pre-existing exemption, unaffected)', () => {
    expect(isPublic('/api/v1/certificates/verify')).toBe(true);
  });

  it('does not treat other /api/v1/certificates routes as public just because the prefix matches', () => {
    expect(isPublic('/api/v1/certificates')).toBe(false);
    expect(isPublic('/api/v1/certificates/issue')).toBe(false);
  });

  it('does not open up unrelated authenticated routes', () => {
    expect(isPublic('/api/v1/teams')).toBe(false);
    expect(isPublic('/api/v1/employees')).toBe(false);
    expect(isPublic('/api/v1/contact/anything-else')).toBe(false);
  });
});
