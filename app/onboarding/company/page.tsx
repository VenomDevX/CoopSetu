'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepShell } from '@/components/onboarding/step-shell';

export default function CompanyStep() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await fetch('/api/v1/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, industry: industry || undefined }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return setError(json.error?.message ?? 'Failed to create organization.');
    // Make the new org active, then continue to the team step.
    await fetch('/api/v1/organizations/active', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: json.data.id }),
    });
    router.push('/onboarding/team');
    router.refresh();
  }

  return (
    <StepShell step={1} title="Create your organization" subtitle="You will become the organization owner">
      <form onSubmit={next} className="space-y-4">
        <input className="w-full h-10 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          placeholder="ORGANIZATION NAME" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full h-10 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          placeholder="INDUSTRY (OPTIONAL)" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
        <button disabled={loading}
          className="w-full h-10 bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50">
          {loading ? 'Creating…' : 'Continue'}
        </button>
      </form>
    </StepShell>
  );
}
