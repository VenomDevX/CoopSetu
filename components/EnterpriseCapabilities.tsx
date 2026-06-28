import Link from 'next/link';
import { 
  ArrowRight, 
  Workflow, 
  ShieldCheck, 
  BrainCircuit, 
  GitPullRequest, 
  ClipboardCheck, 
  ScrollText 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EnterpriseCapabilities() {
  return (
    <section className="py-32 bg-background border-t border-b border-border transition-colors duration-200">
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        
        {/* Header Section */}
        <div className="mb-20">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            ENTERPRISE_CAPABILITIES
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9] text-foreground mb-6">
            Control Delivery.<br />End to End.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl font-light">
            Handoff connects projects, people, engineering activity, quality controls, and release decisions in one accountable operating system.
          </p>
        </div>

        {/* 3x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: EXECUTION */}
          <div className="group border border-border bg-background hover:bg-surface-hover hover:border-foreground/30 transition-all duration-300 flex flex-col p-8 min-h-[320px] rounded-[4px] relative overflow-hidden focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-10 h-10 border border-border flex items-center justify-center bg-background shrink-0">
                <Workflow className="w-4 h-4 text-foreground" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                EXECUTION
              </span>
            </div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-foreground mb-4 relative z-10">
              Project & Work Orchestration
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1 relative z-10">
              Plan portfolios, projects, epics, tasks, dependencies, owners, priorities, and deadlines from one controlled workspace.
            </p>
            <div className="mt-8 pt-6 border-t border-border flex flex-col gap-4 relative z-10">
              <Link href="/product#work-management" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground group-hover:text-foreground/80 transition-colors focus:outline-none">
                Explore Work Management <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                WORKFLOW_SYNCED
              </span>
            </div>
          </div>

          {/* Card 2: CONTROL */}
          <div className="group border border-border bg-background hover:bg-surface-hover hover:border-foreground/30 transition-all duration-300 flex flex-col p-8 min-h-[320px] rounded-[4px] relative overflow-hidden focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-10 h-10 border border-border flex items-center justify-center bg-background shrink-0">
                <ShieldCheck className="w-4 h-4 text-foreground" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                CONTROL
              </span>
            </div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-foreground mb-4 relative z-10">
              Role-Based Access & Approvals
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1 relative z-10">
              Give every team the right level of access and require accountable sign-off for sensitive work, reviews, and releases.
            </p>
            <div className="mt-8 pt-6 border-t border-border flex flex-col gap-4 relative z-10">
              <Link href="/enterprise#access-control" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground group-hover:text-foreground/80 transition-colors focus:outline-none">
                Explore Access Controls <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                APPROVAL_REQUIRED
              </span>
            </div>
          </div>

          {/* Card 3: INTELLIGENCE (Special styling) */}
          <div className="group border border-border bg-[#F2F2F2] dark:bg-surface-elevated hover:border-foreground/30 transition-all duration-300 flex flex-col p-8 min-h-[320px] rounded-[4px] relative overflow-hidden focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.03] pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10 justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border border-border flex items-center justify-center bg-background shrink-0">
                  <BrainCircuit className="w-4 h-4 text-foreground" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  INTELLIGENCE
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 border border-border bg-background">
                <span className="w-1.5 h-1.5 bg-foreground animate-pulse" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-foreground">
                  AI_CONTEXT_READY
                </span>
              </div>
            </div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-foreground mb-4 relative z-10">
              Handoff AI
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1 relative z-10">
              Turn delivery signals into risk summaries, task plans, workload insights, sprint forecasts, and evidence-backed next actions.
            </p>
            <div className="mt-8 pt-6 border-t border-border flex flex-col gap-4 relative z-10">
              <Link href="/ai" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground group-hover:text-foreground/80 transition-colors focus:outline-none">
                Explore AI Copilot <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Card 4: ENGINEERING */}
          <div className="group border border-border bg-background hover:bg-surface-hover hover:border-foreground/30 transition-all duration-300 flex flex-col p-8 min-h-[320px] rounded-[4px] relative overflow-hidden focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-10 h-10 border border-border flex items-center justify-center bg-background shrink-0">
                <GitPullRequest className="w-4 h-4 text-foreground" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                ENGINEERING
              </span>
            </div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-foreground mb-4 relative z-10">
              Code, PRs & CI/CD Sync
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1 relative z-10">
              Connect projects to repositories, pull requests, build pipelines, environments, deployments, and release activity.
            </p>
            <div className="mt-8 pt-6 border-t border-border flex flex-col gap-4 relative z-10">
              <Link href="/product#engineering" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground group-hover:text-foreground/80 transition-colors focus:outline-none">
                Explore Engineering Sync <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                SOURCE_CONNECTED
              </span>
            </div>
          </div>

          {/* Card 5: ASSURANCE */}
          <div className="group border border-border bg-background hover:bg-surface-hover hover:border-foreground/30 transition-all duration-300 flex flex-col p-8 min-h-[320px] rounded-[4px] relative overflow-hidden focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-10 h-10 border border-border flex items-center justify-center bg-background shrink-0">
                <ClipboardCheck className="w-4 h-4 text-foreground" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                ASSURANCE
              </span>
            </div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-foreground mb-4 relative z-10">
              QA, Security & Release Gates
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1 relative z-10">
              Track test evidence, bugs, security reviews, compliance checks, approval chains, and production readiness.
            </p>
            <div className="mt-8 pt-6 border-t border-border flex flex-col gap-4 relative z-10">
              <Link href="/security#release-governance" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground group-hover:text-foreground/80 transition-colors focus:outline-none">
                Explore Quality Controls <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                CONTROL_LAYER_ACTIVE
              </span>
            </div>
          </div>

          {/* Card 6: GOVERNANCE */}
          <div className="group border border-border bg-background hover:bg-surface-hover hover:border-foreground/30 transition-all duration-300 flex flex-col p-8 min-h-[320px] rounded-[4px] relative overflow-hidden focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-10 h-10 border border-border flex items-center justify-center bg-background shrink-0">
                <ScrollText className="w-4 h-4 text-foreground" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                GOVERNANCE
              </span>
            </div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-foreground mb-4 relative z-10">
              Audit & Knowledge Record
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1 relative z-10">
              Keep documents, decisions, task history, approval records, incidents, and delivery evidence connected and searchable.
            </p>
            <div className="mt-8 pt-6 border-t border-border flex flex-col gap-4 relative z-10">
              <Link href="/enterprise#audit-governance" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground group-hover:text-foreground/80 transition-colors focus:outline-none">
                Explore Audit Records <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

        </div>

        {/* Bottom CTA */}
        <div className="mt-16 pt-12 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <h3 className="text-2xl font-bold tracking-tighter uppercase text-foreground">
            One operating system for enterprise delivery.
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <Button asChild size="lg" className="w-full sm:w-auto rounded-[4px] h-12 px-8 text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <Link href="/product">Explore the Platform</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto rounded-[4px] h-12 px-8 text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <Link href="/dashboard?mode=demo">Request Demo</Link>
            </Button>
          </div>
        </div>

      </div>
    </section>
  );
}
