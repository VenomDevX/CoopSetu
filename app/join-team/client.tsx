'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Users } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

interface Preview {
  teamName: string;
  eventName?: string | null;
  availableSpots: number;
}

function formatCode(raw: string) {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parts = [cleaned.slice(0, 4), cleaned.slice(4, 8), cleaned.slice(8, 12)].filter(Boolean);
  return parts.join('-');
}

export default function JoinTeamClient() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPreview(null);
    setChecking(true);
    try {
      const res = await fetch('/api/v1/join-team/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Invalid or expired join code.');
      setPreview(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleJoin() {
    setError(null);
    setJoining(true);
    try {
      const res = await fetch('/api/v1/join-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Invalid or expired join code.');

      router.push('/dashboard/teams');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setJoining(false);
    }
  }

  return (
    <OnboardingShell
      currentStep={1}
      totalSteps={1}
      stepLabel="Join a Team"
      title="Join a Student Team"
      subtitle="Enter the secure join code from your team leader."
    >
      <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {error && (
          <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">{error}</div>
        )}

        {!preview ? (
          <form onSubmit={handlePreview} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Join Code</label>
              <input
                className="w-full h-14 px-4 bg-surface border border-border text-center text-xl font-mono tracking-widest focus:outline-none focus:border-foreground transition-colors"
                placeholder="TEAM-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                maxLength={14}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={code.length < 4 || checking}
              className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Check Code <ChevronRight className="w-4 h-4" /></>}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="p-6 border border-border bg-surface flex items-start gap-4">
              <Users className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">{preview.teamName}</div>
                {preview.eventName && <div className="text-sm text-muted-foreground mb-1">{preview.eventName}</div>}
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  {preview.availableSpots} spot{preview.availableSpots === 1 ? '' : 's'} available
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="flex-1 h-11 border border-border text-xs font-mono uppercase tracking-widest hover:bg-surface-hover transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining || preview.availableSpots <= 0}
                className="flex-1 h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join Team'}
              </button>
            </div>
          </div>
        )}
      </div>
    </OnboardingShell>
  );
}
