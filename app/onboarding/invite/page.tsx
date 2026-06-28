'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepShell } from '@/components/onboarding/step-shell';

const ROLES = ['PROJECT_MANAGER', 'TEAM_MANAGER', 'DEVELOPER', 'QA_ENGINEER', 'SECURITY_ENGINEER'];

export default function InviteStep() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [sent, setSent] = useState<{ email: string; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await fetch('/api/v1/members/invite', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role_code: role }),
    });
    const j = await res.json();
    setLoading(false);
    if (!res.ok) return setError(j.error?.message ?? 'Failed to invite.');
    setSent((s) => [...s, { email, url: j.data.accept_url }]);
    setEmail('');
  }

  return (
    <StepShell step={3} title="Invite your team" subtitle="Local dev: copy the invite link to share">
      <form onSubmit={invite} className="space-y-3">
        <input className="w-full h-10 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          type="email" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="w-full h-10 px-3 bg-background border border-border text-xs font-mono uppercase tracking-widest">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
        <button disabled={loading}
          className="w-full h-10 border border-border text-xs font-mono uppercase tracking-widest disabled:opacity-50">
          {loading ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {sent.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          {sent.map((s, i) => (
            <div key={i} className="text-[10px] font-mono break-all">
              <span className="text-foreground">{s.email}</span>
              <div className="text-muted-foreground">{s.url}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => router.push('/onboarding/project')}
        className="w-full h-10 bg-foreground text-background text-xs font-mono uppercase tracking-widest">
        Continue
      </button>
    </StepShell>
  );
}
