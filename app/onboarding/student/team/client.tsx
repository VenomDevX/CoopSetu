'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Check, Copy } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

export default function TeamCreationClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [eventName, setEventName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [expectedTeamSize, setExpectedTeamSize] = useState('');
  const [maxTeamSize, setMaxTeamSize] = useState('10');
  const [primaryTeamRole, setPrimaryTeamRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const maxSizeNum = Number(maxTeamSize);
  const isValid = name.trim().length >= 2 && maxSizeNum >= 1 && maxSizeNum <= 50;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/student-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          eventName: eventName.trim() || undefined,
          shortDescription: shortDescription.trim() || undefined,
          expectedTeamSize: expectedTeamSize ? Number(expectedTeamSize) : undefined,
          maxTeamSize: maxSizeNum,
          primaryTeamRole: primaryTeamRole.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create team');

      setJoinCode(data.data.joinCode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  function copyCode() {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (joinCode) {
    return (
      <OnboardingShell
        currentStep={4}
        totalSteps={4}
        stepLabel="Student Setup"
        title="Your team is ready"
        subtitle="Share this code with teammates so they can join. It's shown only this once — you can rotate it later from Team Settings if you lose it."
      >
        <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border border-border rounded bg-surface flex items-center justify-between gap-4">
            <span className="font-mono text-2xl tracking-widest">{joinCode}</span>
            <button
              type="button"
              onClick={copyCode}
              className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest border border-border rounded hover:border-foreground/40 flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { router.push('/dashboard/teams'); }}
            className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors"
          >
            Continue to Team Setup <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      currentStep={4}
      totalSteps={4}
      stepLabel="Student Setup"
      title="Create a Student Team"
      subtitle="For hackathons, group assignments, clubs, and collaborative student projects."
      onBack={() => router.push('/onboarding/student')}
    >
      <form onSubmit={handleSubmit} className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {error && (
          <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">{error}</div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Team Name</label>
          <input
            className="w-full h-11 px-4 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors"
            placeholder="Byte Bandits"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Hackathon / Event Name (Optional)</label>
          <input
            className="w-full h-11 px-4 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors"
            placeholder="HackNYC 2026"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Short Description (Optional)</label>
          <textarea
            className="w-full h-20 px-4 py-3 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
            maxLength={500}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Expected Team Size</label>
            <input
              type="number"
              min={1}
              className="w-full h-11 px-4 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors"
              placeholder="4"
              value={expectedTeamSize}
              onChange={(e) => setExpectedTeamSize(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Maximum Team Size</label>
            <input
              type="number"
              min={1}
              max={50}
              className="w-full h-11 px-4 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors"
              value={maxTeamSize}
              onChange={(e) => setMaxTeamSize(e.target.value)}
              required
            />
          </div>
        </div>
        {(maxSizeNum < 1 || maxSizeNum > 50) && (
          <p className="text-[10px] text-red-500 font-mono -mt-4">Maximum team size must be between 1 and 50.</p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Your Primary Team Role (Optional)</label>
          <input
            className="w-full h-11 px-4 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors"
            placeholder="Backend Developer"
            value={primaryTeamRole}
            onChange={(e) => setPrimaryTeamRole(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full h-11 bg-foreground text-background rounded-[6px] text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Team <ChevronRight className="w-4 h-4" /></>}
        </button>
      </form>
    </OnboardingShell>
  );
}
