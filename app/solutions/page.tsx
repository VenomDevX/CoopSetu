'use client';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { AiLogo } from '@/components/ai/ai-logo';

import React from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/components/layout/public-footer';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  BarChart3, 
  CheckCircle2, 
  GitPullRequest, 
  Layers, 
  Lock, 
  Shield, 
  Terminal, 
  Activity, 
  Cpu, 
  Loader2,
  Menu,
  X,
  ChevronRight,
  Database,
  Globe,
  Settings,
  Users,
  Briefcase,
  AlertCircle,
  Eye,
  FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SolutionsPage() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navType, setNavType] = React.useState<string | null>(null);
  
  // Mock feature state
  const [isApproved, setIsApproved] = React.useState(false);

  const handleNavigate = (path: string, type: string) => {
    setNavType(type);
    setIsNavigating(true);
    router.push(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-200">
      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-24">
        {/* HERO SECTION */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              SOLUTIONS_BY_TEAM
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              Built for every team responsible for shipping software.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              From product planning to incident response, HANDOFF gives every delivery function a shared operating system.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/product', 'explore')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Explore Solutions
              </Button>
              <Button 
                onClick={() => handleNavigate('/contact', 'demo')}
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Request Demo
              </Button>
            </div>
          </div>
        </section>

        {/* SECTION 1 - Engineering Leadership */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Give engineering leaders a real-time view of delivery.</h2>
              </div>
              <p className="text-muted-foreground mb-8 text-lg">
                Stop guessing about delivery dates and team capacity. Get out of disconnected tools and into a unified portfolio view.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> No project visibility</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> Unclear capacity</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> Moving delivery dates</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> Disconnected tools</div>
              </div>

              <div className="space-y-4 font-mono text-sm uppercase tracking-widest">
                <div className="text-[10px] text-accent font-bold mb-4">HANDOFF SOLUTION</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Portfolio dashboards</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Project health scoring</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cross-team dependencies</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Handoff AI risk summaries</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-4 relative shadow-xl">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-surface-hover rounded-tr-[100px] pointer-events-none -z-10" />
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Executive Portfolio</span>
                <span>Q3 Delivery</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-surface p-4 border border-border rounded">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Org Velocity</div>
                  <div className="text-2xl font-bold">1,240 <span className="text-xs text-muted-foreground">pts</span></div>
                </div>
                <div className="bg-surface p-4 border border-border rounded">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Projects at Risk</div>
                  <div className="text-2xl font-bold text-orange-500">3</div>
                </div>
              </div>
              <div className="bg-surface p-4 border border-border rounded">
                 <div className="text-[10px] uppercase text-muted-foreground mb-3 font-bold">Strategic Initiatives</div>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center border-b border-border pb-2">
                     <span className="text-xs font-bold">Core Billing Migration</span>
                     <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 border border-emerald-500">HEALTHY</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold">EU Data Residency</span>
                     <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 border border-orange-500">AT RISK</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 - Product Managers */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                Roadmap & Backlog
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4 flex gap-4 items-center">
                   <div className="w-8 h-8 bg-surface border border-border rounded flex items-center justify-center font-bold">Q3</div>
                   <div className="flex-1">
                     <div className="text-sm font-bold mb-1">New Authentication Flow</div>
                     <div className="w-full h-1.5 bg-surface border border-border rounded"><div className="h-full bg-foreground w-[40%]" /></div>
                   </div>
                 </div>
                 <div className="pl-12 space-y-2">
                    <div className="bg-background border border-border rounded p-3 flex justify-between items-center text-xs">
                      <span>Implement OAuth2 Providers</span>
                      <span className="font-mono text-[10px] text-muted-foreground">IN PROGRESS</span>
                    </div>
                    <div className="bg-background border border-border rounded p-3 flex justify-between items-center text-xs">
                      <span>Update Login UI Components</span>
                      <span className="font-mono text-[10px] text-muted-foreground">BACKLOG</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Briefcase className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Turn strategy into clear, accountable execution.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Roadmaps & Backlogs</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Epics and user stories</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Sprint planning</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Milestone tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> AI task generation</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Engineering Managers */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Balance work before teams become overloaded.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Team capacity & Workload</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Skill mapping</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Assignee recommendations</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Sprint risk detection</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Bottleneck identification</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2 flex justify-between">
                <span>Team Workload</span>
                <span>Frontend Team</span>
              </div>
              <div className="space-y-6">
                 {['S. Jenkins', 'A. Moore', 'P. Patel'].map((name, i) => {
                   const workload = [95, 115, 60][i];
                   const isOver = workload > 100;
                   return (
                     <div key={name}>
                       <div className="flex justify-between text-xs font-bold mb-2">
                         <span>{name}</span>
                         <span className={`font-mono ${isOver ? 'text-orange-500' : ''}`}>{workload}%</span>
                       </div>
                       <div className="h-2 w-full bg-surface border border-border rounded">
                         <div className={`h-full ${isOver ? 'bg-orange-500' : 'bg-foreground'}`} style={{ width: `${Math.min(workload, 100)}%` }} />
                       </div>
                     </div>
                   );
                 })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - Developers */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                Developer Workspace
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4">
                   <div className="flex justify-between items-start mb-4">
                     <div className="text-sm font-bold">Implement rate limiting middleware</div>
                     <span className="text-[10px] font-mono border border-border rounded px-2 py-0.5 bg-surface">IN PROGRESS</span>
                   </div>
                   <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground mt-4 pt-4 border-t border-border">
                     <span className="flex items-center gap-1"><GitPullRequest className="w-3 h-3" /> PR #1042 Open</span>
                     <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> CI: Passing</span>
                   </div>
                 </div>
                 
                 <div className="border border-accent/30 bg-accent/5 p-3 flex gap-3">
                   <AiLogo className="w-4 h-4 text-accent flex-shrink-0" />
                   <div>
                     <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-1">Handoff Summary</div>
                     <p className="text-[10px] leading-relaxed text-muted-foreground">Changes look good. Make sure to update the API documentation to reflect the new 429 response structure.</p>
                   </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Terminal className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Keep planning, code, reviews, and releases connected.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> My Work dashboard</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Linked Git branches & PRs</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> CI/CD status on tasks</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Code review requests</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> AI pull request summaries</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 - QA Teams */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Make quality visible before production.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Test plans & test cases</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Bug & regression tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> UAT approval workflows</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Release readiness checks</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> AI-generated test cases</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Test Run: Release 2.4</span>
                <span className="text-orange-500 font-bold">1 BLOCKER</span>
              </div>
              <div className="space-y-3">
                 <div className="bg-surface border border-border rounded p-3 flex items-center justify-between">
                   <span className="text-xs font-bold">Login with SSO</span>
                   <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500 px-2 bg-emerald-500/10">PASSED</span>
                 </div>
                 <div className="bg-surface border border-border rounded p-3 flex items-center justify-between">
                   <span className="text-xs font-bold">Payment Processing</span>
                   <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500 px-2 bg-emerald-500/10">PASSED</span>
                 </div>
                 <div className="bg-background border border-orange-500 p-3 flex flex-col gap-2">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold">Invoice Generation PDF</span>
                     <span className="text-[10px] font-mono text-orange-500 border border-orange-500 px-2 bg-orange-500/10">FAILED</span>
                   </div>
                   <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Layout breaks on multi-page invoices</div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - Security & Compliance */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Security Review Gate</span>
                <span className="text-accent font-bold">PENDING</span>
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4">
                   <div className="text-sm font-bold mb-3">Release 2.4 Security Requirements</div>
                   <div className="space-y-2">
                     <div className="flex items-center gap-3 text-xs">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Static Analysis (SAST) Passed
                     </div>
                     <div className="flex items-center gap-3 text-xs">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Dependency Scan Passed
                     </div>
                     <div className="flex items-center gap-3 text-xs">
                       <div className="w-4 h-4 border border-border rounded bg-surface" /> Manual Pen-test Signoff Required
                     </div>
                   </div>
                 </div>
                 <Button 
                   onClick={() => setIsApproved(true)}
                   disabled={isApproved}
                   className={`w-full h-8 rounded font-mono text-[10px] uppercase tracking-widest ${isApproved ? 'bg-background text-foreground border border-border rounded' : 'bg-foreground text-background'}`}
                 >
                   {isApproved ? <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Approved</span> : 'Approve & Sign'}
                 </Button>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Build security and compliance into delivery.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Security review workflows</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Vulnerability management</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Approval gates & audit logs</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Compliance evidence collection</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7 - DevOps & Platform */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Layers className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Connect delivery decisions to production reality.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> CI/CD pipeline visibility</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Environment tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Deployment approvals</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Incident response workflows</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Service ownership</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Deployments</span>
                <span>Production</span>
              </div>
              <div className="space-y-3">
                 <div className="bg-surface border border-border rounded p-3">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold">API Gateway v1.5.0</span>
                     <span className="text-[10px] font-mono text-emerald-500">SUCCESS</span>
                   </div>
                   <div className="text-[10px] font-mono text-muted-foreground flex gap-4">
                     <span>Deployed 2h ago</span>
                     <span>Triggered by: S. Jenkins</span>
                   </div>
                 </div>
                 <div className="bg-background border border-border rounded p-3 opacity-70">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold">Auth Service v2.1.2</span>
                     <span className="text-[10px] font-mono text-muted-foreground">ROLLED BACK</span>
                   </div>
                   <div className="text-[10px] font-mono text-muted-foreground flex gap-4">
                     <span>Deployed yesterday</span>
                     <span>Triggered by: System</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8 - Fintech & Regulated */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="bg-surface border border-border rounded p-8 lg:p-16 text-center max-w-5xl mx-auto shadow-2xl">
            <Lock className="w-12 h-12 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Control delivery where accountability matters.</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
              Designed for controlled environments, HANDOFF supports strict compliance workflows for fintech, healthcare, and enterprise organizations.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs uppercase tracking-widest text-foreground text-left">
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                Segregation of Duties
              </div>
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <GitPullRequest className="w-5 h-5 text-muted-foreground" />
                Approval Chains
              </div>
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <Database className="w-5 h-5 text-muted-foreground" />
                Immutable Audit Logs
              </div>
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                Release Evidence
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 9 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16 border-t border-border">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            One platform. Every team. Clear accountability.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              Request Demo
            </Button>
            <Button 
              onClick={() => handleNavigate('/contact', 'sales')}
              variant="outline"
              className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              Contact Sales
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <PublicFooter />

      {/* Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface border border-border rounded p-8 flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
            <Loader2 className="w-8 h-8 text-foreground animate-spin mb-6" />
            <div className="font-mono text-xs uppercase tracking-widest text-center text-muted-foreground">
              {navType === 'signin' ? 'AUTHENTICATING' : 'INITIALIZING WORKSPACE'}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
