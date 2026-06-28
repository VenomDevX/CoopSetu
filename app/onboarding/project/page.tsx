'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepShell } from '@/components/onboarding/step-shell';

export default function ProjectStep() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await fetch('/api/v1/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, code: code.toUpperCase() }),
    });
    const j = await res.json();
    setLoading(false);
    if (!res.ok) return setError(j.error?.message ?? 'Failed to create project.');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <StepShell step={4} title="Create your first project" subtitle="You can add more anytime">
      <form onSubmit={finish} className="space-y-4">
        <input className="w-full h-10 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          placeholder="PROJECT NAME" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full h-10 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground uppercase"
          placeholder="CODE (E.G. PAY)" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
          maxLength={20} required />
        {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push('/dashboard')}
            className="h-10 px-4 border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground">Skip</button>
          <button disabled={loading}
            className="flex-1 h-10 bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50">
            {loading ? 'Creating…' : 'Finish & Open Dashboard'}
          </button>
        </div>
      </form>
    </StepShell>
  );
}
