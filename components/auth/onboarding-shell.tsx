'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { CheckCircle2, Github, Mail, ArrowLeft } from 'lucide-react';

type Step = {
  id: number;
  label: string;
};

export type OnboardingShellProps = {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showConnectedAccount?: boolean;
  connectedAccount?: {
    provider: 'github' | 'email';
    label: string;
  };
  /** Called when the back arrow above the step label is clicked. Omit to hide it. */
  onBack?: () => void;
  backLabel?: string;
  /** Overrides the left-panel step list. Defaults to the enterprise 4-step flow. */
  steps?: Step[];
};

const ENTERPRISE_STEPS: Step[] = [
  { id: 1, label: 'Account Details' },
  { id: 2, label: 'Professional Identity' },
  { id: 3, label: 'Organization Setup' },
  { id: 4, label: 'Workspace Setup' }
];

export function OnboardingShell({
  currentStep,
  totalSteps,
  stepLabel,
  title,
  subtitle,
  children,
  showConnectedAccount,
  connectedAccount,
  onBack,
  backLabel = 'Back',
  steps = ENTERPRISE_STEPS,
}: OnboardingShellProps) {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
      {/* LEFT: Branding & Info (44%) - Hidden on mobile */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] border-r border-border bg-surface relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

        <div className="p-12 relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <Logo width={32} height={32} />
            <span className="uppercase tracking-widest text-base font-bold">HANDOFF</span>
          </div>

          <h1 className="text-4xl font-semibold leading-tight mb-6 tracking-tight">
            Enterprise work management,<br />precision engineered.
          </h1>
          <p className="text-muted-foreground text-lg mb-12 max-w-md leading-relaxed">
            Unify your product, engineering, and operations teams into a single, cohesive delivery machine.
          </p>

          <div className="space-y-6">
            {steps.map((step) => {
              const isPast = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const isFuture = currentStep < step.id;

              return (
                <div key={step.id} className={`flex items-center gap-4 transition-opacity duration-300 ${isFuture ? 'opacity-40' : 'opacity-100'}`}>
                  <CheckCircle2 className={`w-5 h-5 ${isPast ? 'text-foreground' : 'text-muted-foreground'}`} />
                  <div className="flex flex-col">
                    <span className="font-mono text-xs uppercase tracking-widest">Step 0{step.id}</span>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-12 relative z-10 flex gap-4">
          <span className="px-3 py-1 bg-background border border-border text-[10px] font-mono uppercase tracking-widest rounded-sm">SOC2 Type II</span>
          <span className="px-3 py-1 bg-background border border-border text-[10px] font-mono uppercase tracking-widest rounded-sm">End-to-End Encrypted</span>
        </div>
      </div>

      {/* RIGHT: Form Area (56%) */}
      <div className="w-full lg:w-[56%] flex flex-col relative overflow-y-auto">
        {currentStep === 1 && (
          <div className="absolute top-6 right-8 text-sm font-mono text-muted-foreground z-10 hidden md:block">
            Already have an account? <Link href="/login" className="text-foreground border-b border-foreground hover:opacity-80 transition-opacity pb-0.5">Sign in</Link>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto px-6 py-24 min-h-full">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center gap-3 mb-12">
            <Logo width={24} height={24} />
            <span className="uppercase tracking-widest text-sm font-bold">HANDOFF</span>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="mb-8">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
                </button>
              )}

              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 block">
                {stepLabel}
              </span>

              <h2 className="text-2xl font-semibold mb-2">{title}</h2>
              {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}

              {showConnectedAccount && connectedAccount && (
                <div className="mt-6 flex items-center gap-3 p-3 bg-surface border border-border rounded-sm w-fit">
                  {connectedAccount.provider === 'github' ? <Github className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground leading-none mb-1">
                      {connectedAccount.provider === 'github' ? 'GitHub Connected' : 'Email Verified'}
                    </span>
                    <span className="text-sm font-medium leading-none">{connectedAccount.label}</span>
                  </div>
                </div>
              )}
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
