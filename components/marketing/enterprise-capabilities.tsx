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

const CAPABILITIES = [
  {
    id: 1,
    category: 'EXECUTION',
    status: 'WORKFLOW_SYNCED',
    title: 'Project & Work Orchestration',
    description: 'Plan portfolios, projects, epics, tasks, dependencies, owners, priorities, and deadlines from one controlled workspace.',
    features: [
      'Project planning',
      'Team assignments',
      'Task dependencies',
      'Sprint delivery'
    ],
    linkText: 'Explore Work Management',
    linkHref: '/product#work-management',
    icon: Workflow,
    isAi: false
  },
  {
    id: 2,
    category: 'CONTROL',
    status: 'APPROVAL_REQUIRED',
    title: 'Role-Based Access & Approvals',
    description: 'Give every team the right level of access and require accountable sign-off for sensitive work, reviews, releases, and changes.',
    features: [
      'Organization roles',
      'Project permissions',
      'Approval workflows',
      'Audit visibility'
    ],
    linkText: 'Explore Access Controls',
    linkHref: '/enterprise#access-control',
    icon: ShieldCheck,
    isAi: false
  },
  {
    id: 3,
    category: 'INTELLIGENCE',
    status: 'AI_CONTEXT_READY',
    title: 'Handoff AI',
    description: 'Turn authorized delivery signals into risk summaries, task plans, workload insights, sprint forecasts, and evidence-backed next actions.',
    features: [
      'Grounded workspace analysis',
      'Permission-aware summaries',
      'Real source citations',
      'Streaming responses'
    ],
    linkText: 'Explore AI Copilot',
    linkHref: '/ai',
    icon: BrainCircuit,
    isAi: true
  },
  {
    id: 4,
    category: 'ENGINEERING',
    status: 'SOURCE_CONNECTED',
    title: 'Code, PRs & CI/CD Sync',
    description: 'Connect projects to repositories, pull requests, build pipelines, environments, deployments, and release activity.',
    features: [
      'Repository connections',
      'Pull request visibility',
      'Deployment records',
      'Release tracking'
    ],
    linkText: 'Explore Engineering Sync',
    linkHref: '/product#engineering',
    icon: GitPullRequest,
    isAi: false
  },
  {
    id: 5,
    category: 'ASSURANCE',
    status: 'CONTROL_LAYER_ACTIVE',
    title: 'QA, Security & Release Gates',
    description: 'Track test evidence, bugs, security reviews, compliance checks, approval chains, and production readiness.',
    features: [
      'Bug management',
      'Test plans',
      'Security reviews',
      'Release approvals'
    ],
    linkText: 'Explore Quality Controls',
    linkHref: '/security#release-governance',
    icon: ClipboardCheck,
    isAi: false
  },
  {
    id: 6,
    category: 'GOVERNANCE',
    status: 'RECORDS_INDEXED',
    title: 'Audit & Knowledge Record',
    description: 'Keep documents, decisions, task history, approvals, incidents, and delivery evidence connected and searchable.',
    features: [
      'Audit history',
      'Project documents',
      'Decision records',
      'Searchable evidence'
    ],
    linkText: 'Explore Audit Records',
    linkHref: '/enterprise#audit-governance',
    icon: ScrollText,
    isAi: false
  }
];

export function EnterpriseCapabilities() {
  return (
    <section className="relative py-24 bg-background border-t border-b border-white/5 transition-colors duration-200">
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        <div className="mb-16">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            ENTERPRISE_CAPABILITIES
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground mb-6 max-w-3xl">
            Capabilities for controlled delivery operations.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {CAPABILITIES.map((card) => {
            const Icon = card.icon;
            return (
              <div 
                key={card.id} 
                className="relative flex min-h-[360px] flex-col border border-white/10 bg-background p-7 overflow-hidden min-w-0"
              >
                {/* Background grid texture */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                {/* Top: Icon + Label + Badge */}
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 border border-white/10 bg-background shrink-0">
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground break-words">
                      {card.category}
                    </span>
                  </div>
                  {card.isAi ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 border border-white/10 bg-background shrink-0">
                      <span className="w-1.5 h-1.5 bg-foreground animate-pulse shrink-0" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-foreground">
                        {card.status}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 hidden sm:block shrink-0">
                      {card.status}
                    </span>
                  )}
                </div>

                {/* Middle: Title + Description + Bullets */}
                <div className="flex-1 relative z-10 flex flex-col">
                  <h3 className="text-xl font-bold uppercase tracking-tighter text-foreground mb-3 break-words">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 break-words">
                    {card.description}
                  </p>
                  
                  <ul className="space-y-2 mb-6">
                    {card.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80 break-words">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom: Divider + CTA */}
                <div className="pt-6 border-t border-white/10 mt-auto relative z-10">
                  <Link 
                    href={card.linkHref} 
                    className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground hover:text-foreground/80 transition-colors focus:outline-none group"
                  >
                    {card.linkText} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 shrink-0" />
                  </Link>
                  {!card.isAi && card.status && (
                    <div className="sm:hidden mt-3">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 block">
                        {card.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Purple gradient glow at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-accent/20 to-transparent pointer-events-none" />
    </section>
  );
}
