'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepShell } from '@/components/onboarding/step-shell';

export default function TeamStep() {
  const router = useRouter();
  const [dept, setDept] = useState('Engineering');
  const [team, setTeam] = useState('Core Team');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      if (dept.trim()) {
        await fetch('/api/v1/departments', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: dept.trim() }),
        });
      }
      const res = await fetch('/api/v1/teams', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: team.trim(), capacity_hours_per_week: 200 }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error?.message ?? 'Failed.'); }
      router.push('/onboarding/invite');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepShell step={2} title="Create your first team" subtitle="Departments group teams; teams hold members">
      <form onSubmit={next} className="space-y-4">
        <input className="w-full h-10 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          placeholder="DEPARTMENT NAME" value={dept} onChange={(e) => setDept(e.target.value)} />
        <input className="w-full h-10 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          placeholder="TEAM NAME" value={team} onChange={(e) => setTeam(e.target.value)} required />
        {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push('/onboarding/invite')}
            className="h-10 px-4 border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground">Skip</button>
          <button disabled={loading}
            className="flex-1 h-10 bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50">
            {loading ? 'Creating…' : 'Continue'}
          </button>
        </div>
      </form>
    </StepShell>
  );
}
