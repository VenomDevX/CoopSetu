'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2 } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

const STEPS = [
  { id: 1, label: 'Account' },
  { id: 2, label: 'Profile' },
  { id: 3, label: 'Workspace Path' },
  { id: 4, label: 'Student Setup' },
];

export default function SoloWorkspaceClient({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = name.trim().length >= 2;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/student-workspaces/solo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create workspace');

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      currentStep={4}
      totalSteps={4}
      stepLabel="Personal Workspace"
      title="Create your personal workspace"
      subtitle="A private place for your coursework, ideas, projects, tasks, and personal delivery planning."
      steps={STEPS}
      onBack={() => router.push('/onboarding/student')}
    >
      <form onSubmit={handleSubmit} className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {error && (
          <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">{error}</div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Personal Workspace Name</label>
          <input
            className="w-full h-11 px-4 bg-surface border border-border rounded text-sm focus:outline-none focus:border-foreground transition-colors"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Description (Optional)</label>
          <textarea
            className="w-full h-24 px-4 py-3 bg-surface border border-border rounded text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
            placeholder="What are you working on?"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Workspace <ChevronRight className="w-4 h-4" /></>}
        </button>
      </form>
    </OnboardingShell>
  );
}
