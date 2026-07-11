'use client';

import { useRouter } from 'next/navigation';
import { Briefcase, GraduationCap, ArrowRight } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

export default function WorkspacePathClient() {
  const router = useRouter();

  function choose(intent: 'enterprise' | 'student') {
    document.cookie = `workspace_path_intent=${intent}; path=/; max-age=3600; SameSite=Lax`;
    router.push(intent === 'enterprise' ? '/onboarding/company' : '/onboarding/student');
  }

  return (
    <OnboardingShell
      currentStep={3}
      totalSteps={4}
      stepLabel="Workspace Path"
      title="How will you use Handoff?"
      subtitle="This helps us personalize your workspace setup."
      onBack={() => router.push('/onboarding/profile')}
    >
      <div className="space-y-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button
          type="button"
          onClick={() => choose('enterprise')}
          className="w-full text-left p-6 border border-border rounded bg-surface hover:border-foreground/40 hover:bg-surface-hover transition-colors group"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <Briefcase className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">For Work</div>
                <div className="font-semibold mb-1">Create or join a company workspace</div>
                <p className="text-sm text-muted-foreground">Full enterprise features: teams, roles, billing, integrations, and org-wide administration.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => choose('student')}
          className="w-full text-left p-6 border border-border rounded bg-surface hover:border-foreground/40 hover:bg-surface-hover transition-colors group"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <GraduationCap className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">For Study / Hackathons</div>
                <div className="font-semibold mb-1">Personal workspace, student team, or join with a code</div>
                <p className="text-sm text-muted-foreground">A private space for coursework, or a team workspace for hackathons, clubs, and group projects.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </div>
        </button>
      </div>
    </OnboardingShell>
  );
}
