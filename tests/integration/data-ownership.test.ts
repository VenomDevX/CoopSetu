import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })();

async function freshUser(prefix: string): Promise<{ client: SupabaseClient; userId: string; email: string }> {
  const client = createClient(URL, KEY);
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: TEST_PASSWORD });
  if (error || !data.user) throw new Error(`signup ${email}: ${error?.message}`);
  return { client, userId: data.user.id, email };
}

/**
 * Proves the "raw" per-user data-ownership property end to end against the
 * real local Supabase instance: User B, even when supplying User A's real
 * ids directly, can never read or mutate User A's personal data. This is
 * the concrete verification for the admin-client ownership audit performed
 * in this phase (docs/HANDOFF.md §14) — every site was already correct on
 * inspection; these tests prove it at the DB/RLS layer too, not just by
 * code review.
 */
describe('Data ownership: profiles', () => {
  let userA: Awaited<ReturnType<typeof freshUser>>;
  let userB: Awaited<ReturnType<typeof freshUser>>;

  beforeAll(async () => {
    userA = await freshUser('owner-a');
    userB = await freshUser('owner-b');
  }, 30000);

  it('User A can read and update their own profile', async () => {
    const { data, error } = await userA.client
      .from('profiles')
      .update({ full_name: 'User A Updated' })
      .eq('id', userA.userId)
      .select('full_name')
      .single();
    expect(error).toBeNull();
    expect(data?.full_name).toBe('User A Updated');
  });

  it("User B cannot read User A's profile row directly by id (no shared org)", async () => {
    const { data } = await userB.client
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userA.userId);
    expect(data ?? []).toHaveLength(0);
  });

  it("User B cannot update User A's profile even when supplying User A's real id", async () => {
    const { data, error } = await userB.client
      .from('profiles')
      .update({ full_name: 'Hijacked By B' })
      .eq('id', userA.userId)
      .select('full_name');
    // RLS silently filters the row out of the update rather than erroring —
    // the meaningful assertion is that no row was affected.
    expect(data ?? []).toHaveLength(0);

    const { data: check } = await userA.client
      .from('profiles')
      .select('full_name')
      .eq('id', userA.userId)
      .single();
    expect(check?.full_name).not.toBe('Hijacked By B');
  });
});

describe('Data ownership: sessions (get_active_sessions / revoke_session RPCs)', () => {
  let userA: Awaited<ReturnType<typeof freshUser>>;
  let userB: Awaited<ReturnType<typeof freshUser>>;

  beforeAll(async () => {
    userA = await freshUser('sess-a');
    userB = await freshUser('sess-b');
  }, 30000);

  it("get_active_sessions only ever returns the caller's own sessions", async () => {
    const { data: sessionsA, error: errA } = await userA.client.rpc('get_active_sessions');
    expect(errA).toBeNull();
    expect(Array.isArray(sessionsA)).toBe(true);

    const { data: sessionsB, error: errB } = await userB.client.rpc('get_active_sessions');
    expect(errB).toBeNull();

    const idsA = new Set((sessionsA ?? []).map((s: { id: string }) => s.id));
    const idsB = new Set((sessionsB ?? []).map((s: { id: string }) => s.id));
    // No overlap: neither user's session list contains the other's session id.
    for (const id of idsB) expect(idsA.has(id)).toBe(false);
  });

  it("User B cannot revoke User A's session even when supplying User A's real session id", async () => {
    const { data: sessionsA } = await userA.client.rpc('get_active_sessions');
    const targetSessionId = (sessionsA ?? [])[0]?.id;
    expect(targetSessionId).toBeTruthy();

    // revoke_session's WHERE clause requires user_id = auth.uid(), so this
    // is a no-op for a session that isn't User B's — it does not throw, it
    // just affects zero rows.
    const { error } = await userB.client.rpc('revoke_session', { p_session_id: targetSessionId });
    expect(error).toBeNull();

    // User A's session must still exist afterward.
    const { data: sessionsAfter } = await userA.client.rpc('get_active_sessions');
    const stillThere = (sessionsAfter ?? []).some((s: { id: string }) => s.id === targetSessionId);
    expect(stillThere).toBe(true);
  });
});

describe('Data ownership: legal acceptances (reconfirmation)', () => {
  it("User B cannot read User A's legal acceptance row", async () => {
    const userA = await freshUser('legal-owner-a');
    const userB = await freshUser('legal-owner-b');

    const { data } = await userB.client
      .from('user_legal_acceptances')
      .select('id')
      .eq('user_id', userA.userId);
    expect(data ?? []).toHaveLength(0);
  });
});
