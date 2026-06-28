'use client';

import { Logo } from '@/components/logo';

const STEPS = ['Company', 'Team', 'Invite', 'Project'];

export function StepShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: number; // 1-based
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-md border border-border bg-surface p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Logo width={28} height={28} />
          <span className="uppercase tracking-widest text-sm font-bold">HANDOFF</span>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`h-1 flex-1 ${i + 1 <= step ? 'bg-foreground' : 'bg-border'}`} />
            </div>
          ))}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Step {step} of {STEPS.length} · {STEPS[step - 1]}
        </div>

        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle && <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {children}
      </div>
    </div>
  );
}
