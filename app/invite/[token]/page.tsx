'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/logo';

interface Invite {
  organization_name: string;
  email: string;
  role_code: string;
  status: string;
  is_expired: boolean;
}

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/invites/accept?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json();
        if (r.status === 401) { setNeedLogin(true); return; }
        if (!r.ok) { setError(j.error?.message ?? 'Could not load invite.'); return; }
        setInvite(j.data);
      })
      .catch(() => setError('Could not load invite.'));
  }, [token]);

  async function accept() {
    setLoading(true); setError(null);
    const res = await fetch('/api/v1/invites/accept', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const j = await res.json();
    setLoading(false);
    if (!res.ok) return setError(j.error?.message ?? 'Could not accept invite.');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm border border-border bg-surface p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Logo width={28} height={28} />
          <span className="uppercase tracking-widest text-sm font-bold">HANDOFF</span>
        </div>

        {needLogin && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Sign in or create an account to accept this invitation.</p>
            <Link href={`/login?next=/invite/${token}`}
              className="block text-center h-10 leading-10 bg-foreground text-background text-xs font-mono uppercase tracking-widest">
              Sign in
            </Link>
            <Link href="/signup" className="block text-center text-xs font-mono text-muted-foreground underline">
              Create account
            </Link>
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-mono">{error}</p>}

        {invite && !needLogin && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold">You&apos;re invited</h1>
            <div className="text-sm text-muted-foreground font-mono space-y-1">
              <div>Organization: <span className="text-foreground">{invite.organization_name}</span></div>
              <div>Role: <span className="text-foreground">{invite.role_code}</span></div>
            </div>
            {invite.is_expired || invite.status !== 'PENDING' ? (
              <p className="text-xs text-red-500 font-mono">This invite is no longer valid.</p>
            ) : (
              <button disabled={loading} onClick={accept}
                className="w-full h-10 bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50">
                {loading ? 'Joining…' : 'Accept & Join'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
