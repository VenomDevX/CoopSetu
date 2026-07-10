'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, XCircle } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';
import { finishWorkspaceSetup } from './actions';

interface TeamClientProps {
  connectedAccount?: { provider: 'github' | 'email'; label: string; };
}

export default function TeamClient({ connectedAccount }: TeamClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleFinish = () => {
    setError(null);
    startTransition(async () => {
      try {
        await finishWorkspaceSetup();
        router.push('/dashboard');
        router.refresh();
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  return (
    <OnboardingShell
      currentStep={4}
      totalSteps={4}
      stepLabel="Workspace Setup"
      title="Finish Setup"
      subtitle="Your workspace is ready. You can create teams later from the Teams workspace."
      showConnectedAccount={true}
      connectedAccount={connectedAccount}
    >
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
        {error && (
          <div className="mb-6 p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono flex items-start gap-3">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="bg-surface p-6 border border-border rounded text-sm text-muted-foreground text-center">
          Team creation requires defining departments and setting up capacity constraints. For now, you can skip this step and set up teams later from your workspace settings.
        </div>

        <button 
          onClick={handleFinish}
          disabled={isPending}
          className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Finishing...</>
          ) : (
            <>Finish Setup <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </OnboardingShell>
  );
}
