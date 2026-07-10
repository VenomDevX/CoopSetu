'use client';
import { Logo } from '@/components/logo';

import React from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/components/layout/public-footer';
import { motion, useScroll, useTransform } from 'motion/react';
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
  Bot
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProductPage() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navType, setNavType] = React.useState<string | null>(null);

  const handleNavigate = (path: string, type: string) => {
    setNavType(type);
    setIsNavigating(true);
    router.push(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-200">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="w-full px-6 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Link href="/" className="font-bold text-lg tracking-tight flex items-center gap-3">
              <Logo width={24} height={24} />
              <span className="uppercase tracking-widest text-xs">HANDOFF</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              <Link href="/product" className="text-foreground transition-colors">Product</Link>
              <Link href="/solutions" className="hover:text-foreground transition-colors">Solutions</Link>
              <Link href="/ai" className="hover:text-foreground transition-colors">AI</Link>
              <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="/enterprise" className="hover:text-foreground transition-colors">Enterprise</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => handleNavigate('/dashboard', 'signin')}
              className="text-xs font-mono uppercase tracking-widest hover:text-muted-foreground transition-colors hidden sm:block"
            >
              Sign In
            </button>
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-9 px-6 text-xs font-mono uppercase tracking-widest"
              disabled={isNavigating}
            >
              {isNavigating && navType === 'demo' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request Demo'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-24">
        {/* HERO SECTION */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              PLATFORM_OVERVIEW
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              One operational system for teams building critical software.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              HANDOFF Enterprise connects planning, task assignment, delivery, engineering workflows, QA, security, releases, and AI intelligence in one controlled workspace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/dashboard', 'explore')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Explore the Platform
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

          {/* Hero Visual */}
          <div className="w-full bg-surface-elevated border border-border rounded p-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
            
            {/* Mock UI Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-foreground" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">Command Center</span>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-border" />
                <div className="w-2 h-2 rounded-full bg-border" />
                <div className="w-2 h-2 rounded-full bg-border" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Project Health */}
               <div className="col-span-2 border border-border rounded bg-background p-4 flex flex-col">
                 <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Active Sprint Board</div>
                 <div className="flex-1 grid grid-cols-4 gap-2">
                   {["Backlog", "In Progress", "Review", "Done"].map(col => (
                     <div key={col} className="bg-surface p-2 border border-border rounded border-dashed flex flex-col gap-2">
                       <div className="text-[10px] font-bold uppercase">{col}</div>
                       <div className="h-16 bg-background border border-border rounded p-2">
                         <div className="w-3/4 h-2 bg-surface-hover mb-2" />
                         <div className="w-1/2 h-2 bg-surface-hover" />
                       </div>
                       {col === "In Progress" && (
                         <div className="h-16 bg-background border border-accent/50 p-2">
                           <div className="w-full h-2 bg-accent/20 mb-2" />
                           <div className="w-2/3 h-2 bg-accent/20" />
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               </div>

               {/* AI Summary & Workload */}
               <div className="flex flex-col gap-4">
                 <div className="border border-border rounded bg-background p-4">
                   <div className="flex items-center gap-2 mb-3">
                     <Bot className="w-3 h-3 text-accent" />
                     <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Handoff Insight</span>
                   </div>
                   <p className="text-xs text-muted-foreground">Release v2.4.0 is blocked by 2 critical security vulnerabilities. QA signoff pending for 3 hours.</p>
                 </div>
                 <div className="border border-border rounded bg-background p-4 flex-1">
                   <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Release Pipeline</div>
                   <div className="space-y-3">
                     <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                       <span className="text-[10px] font-mono">CODE REVIEW</span>
                     </div>
                     <div className="w-[1px] h-3 bg-border ml-1.5" />
                     <div className="flex items-center gap-2">
                       <Loader2 className="w-3 h-3 text-accent animate-spin" />
                       <span className="text-[10px] font-mono text-accent font-bold">QA APPROVAL</span>
                     </div>
                     <div className="w-[1px] h-3 bg-border border-dashed ml-1.5" />
                     <div className="flex items-center gap-2 opacity-50">
                       <Shield className="w-3 h-3" />
                       <span className="text-[10px] font-mono">SEC APPROVAL</span>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 - Command Center */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">See delivery work as it happens.</h2>
            <p className="text-muted-foreground max-w-2xl text-lg">
              Get an immediate, uncompromising view of project health, engineering capacity, and delivery risk across all organizational teams.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 border border-border rounded bg-surface p-6">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6">Global Project Overview</div>
               <table className="w-full text-left text-sm font-mono whitespace-nowrap">
                  <thead className="border-b border-border text-[10px] text-muted-foreground uppercase">
                    <tr>
                      <th className="pb-3 font-normal">Project</th>
                      <th className="pb-3 font-normal">Status</th>
                      <th className="pb-3 font-normal">Progress</th>
                      <th className="pb-3 font-normal">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-4 font-bold flex items-center gap-2"><div className="w-2 h-2 bg-foreground" /> Core Platform Migration</td>
                      <td className="py-4 text-xs">Sprint 24</td>
                      <td className="py-4">
                        <div className="w-24 h-1 bg-surface-hover border border-border rounded overflow-hidden">
                          <div className="h-full bg-foreground w-[65%]" />
                        </div>
                      </td>
                      <td className="py-4"><span className="text-[10px] px-2 py-0.5 border border-emerald-500 text-emerald-500 bg-emerald-500/10">ON TRACK</span></td>
                    </tr>
                    <tr>
                      <td className="py-4 font-bold flex items-center gap-2"><div className="w-2 h-2 bg-foreground" /> Payments API v3</td>
                      <td className="py-4 text-xs">Security Review</td>
                      <td className="py-4">
                        <div className="w-24 h-1 bg-surface-hover border border-border rounded overflow-hidden">
                          <div className="h-full bg-foreground w-[90%]" />
                        </div>
                      </td>
                      <td className="py-4"><span className="text-[10px] px-2 py-0.5 border border-orange-500 text-orange-500 bg-orange-500/10">DELAYED</span></td>
                    </tr>
                  </tbody>
               </table>
            </div>
            <div className="space-y-6">
              <div className="border border-border rounded bg-surface p-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Team Capacity</div>
                <div className="text-3xl font-bold font-mono">92%</div>
                <div className="text-xs text-orange-500 mt-2 font-mono uppercase">14 OVERALLOCATED</div>
              </div>
              <div className="border border-border rounded bg-surface p-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Pending Approvals</div>
                <div className="text-3xl font-bold font-mono">8</div>
                <div className="text-xs text-muted-foreground mt-2 font-mono uppercase">Sec & QA Review</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 - Work Management */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Assign work with clear ownership.</h2>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Projects, programs & portfolios</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Epics, stories, tasks & bugs</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Deadlines & dependencies</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Approval workflows</div>
              </div>
              <Button onClick={() => handleNavigate('/solutions', 'workflows')} variant="outline" className="border-border rounded h-10 px-6 font-mono text-xs uppercase tracking-widest">
                Explore Workflows <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            
            <div className="border border-border rounded bg-background p-4 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-surface-hover rounded-bl-[100px] pointer-events-none" />
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Task Board</span>
                <span>Sprint 24</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Backlog", "Code Review", "QA Testing"].map(status => (
                  <div key={status} className="bg-surface border border-border rounded p-3">
                    <div className="text-[10px] font-bold uppercase mb-3 text-muted-foreground">{status}</div>
                    <div className="bg-background border border-border rounded p-3 mb-2 shadow-sm">
                      <div className="text-xs font-bold mb-2">Update auth tokens</div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                        <span>#1042</span>
                        <div className="w-4 h-4 bg-foreground rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Agile Delivery */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6">
              <div className="flex justify-between items-end mb-8 border-b border-border pb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sprint Health</div>
                  <div className="text-2xl font-bold mt-1">Sprint 42</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Velocity</div>
                  <div className="text-2xl font-mono font-bold text-accent">84 pts</div>
                </div>
              </div>
              
              <div className="space-y-6">
                 <div>
                   <div className="flex justify-between text-xs font-mono uppercase mb-2">
                     <span>Capacity</span>
                     <span>95%</span>
                   </div>
                   <div className="h-2 w-full bg-background border border-border rounded">
                     <div className="h-full w-[95%] bg-foreground" />
                   </div>
                 </div>
                 <div>
                   <div className="flex justify-between text-xs font-mono uppercase mb-2">
                     <span>Carryover Risk</span>
                     <span className="text-orange-500">12%</span>
                   </div>
                   <div className="h-2 w-full bg-background border border-border rounded">
                     <div className="h-full w-[12%] bg-orange-500" />
                   </div>
                 </div>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Plan sprints with real capacity.</h2>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Backlog prioritization</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Story points & velocity</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Scope-change detection</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Automated burndown charts</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - Engineering Visibility */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Connect work to the code that ships.</h2>
            <p className="text-muted-foreground text-lg">
              Integrate directly with GitHub, GitLab, and Bitbucket. Track pull requests, commits, CI/CD pipelines, and deployments from within the task.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-border rounded bg-background p-6">
              <GitPullRequest className="w-8 h-8 text-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">PR Tracking</h3>
              <p className="text-sm text-muted-foreground mb-4">Automatically link pull requests to stories and tasks. Block merging if tests fail.</p>
              <div className="text-[10px] font-mono p-2 bg-surface border border-border rounded text-emerald-500">
                MERGED #1042 into main
              </div>
            </div>
            <div className="border border-border rounded bg-background p-6">
              <Terminal className="w-8 h-8 text-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">CI/CD Visibility</h3>
              <p className="text-sm text-muted-foreground mb-4">View build logs, test results, and environment deployments directly on the ticket.</p>
              <div className="text-[10px] font-mono p-2 bg-surface border border-border rounded flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-accent" />
                BUILDING WORKFLOW
              </div>
            </div>
            <div className="border border-border rounded bg-background p-6">
              <Layers className="w-8 h-8 text-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">Environment Tracking</h3>
              <p className="text-sm text-muted-foreground mb-4">Know exactly which features are deployed to staging, pre-prod, and production.</p>
              <div className="text-[10px] font-mono p-2 bg-surface border border-border rounded text-accent">
                DEPLOYED TO STAGING
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 - Quality, Security & Release */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="border border-border rounded bg-surface p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Ship software with evidence, approvals, and accountability.</h2>
                <div className="space-y-4 font-mono text-sm uppercase tracking-widest">
                  <div className="flex items-center gap-3"><Shield className="w-4 h-4 text-muted-foreground" /> Security review checklists</div>
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> QA test plans & bugs</div>
                  <div className="flex items-center gap-3"><Lock className="w-4 h-4 text-muted-foreground" /> Compliance evidence</div>
                  <div className="flex items-center gap-3"><ArrowRight className="w-4 h-4 text-muted-foreground" /> Release approval chains</div>
                </div>
              </div>
              
              <div className="flex flex-col justify-center gap-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Release Pipeline Flow</div>
                {[
                  { step: 'Code Complete', status: 'done' },
                  { step: 'Code Review', status: 'done' },
                  { step: 'QA Approval', status: 'done' },
                  { step: 'Security Sign-off', status: 'active' },
                  { step: 'Compliance Review', status: 'pending' },
                  { step: 'Production Deploy', status: 'pending' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.status === 'done' ? 'bg-foreground' : item.status === 'active' ? 'bg-accent animate-pulse' : 'bg-surface border border-border rounded'}`} />
                    <div className={`font-mono text-xs uppercase tracking-widest ${item.status === 'pending' ? 'text-muted-foreground' : 'text-foreground font-bold'}`}>
                      {item.step}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 & 7 - Grid Layout */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-border rounded bg-background p-8 lg:p-12">
            <Database className="w-10 h-10 mb-6 text-foreground" />
            <h2 className="text-2xl font-bold tracking-tight mb-4">Keep decisions, systems, and delivery knowledge connected.</h2>
            <p className="text-muted-foreground mb-8 text-sm">
              Architecture records, API documentation, runbooks, and meeting notes—all version-controlled, access-restricted, and linked directly to project execution.
            </p>
            <div className="border border-border rounded bg-surface p-4 text-xs font-mono">
              <div className="text-muted-foreground uppercase tracking-widest text-[10px] mb-2 border-b border-border pb-2">Architecture Decision Record</div>
              <div className="font-bold mb-1">Migrate to Event-Driven Architecture</div>
              <div className="opacity-70">Status: Approved • Author: E. Rodriguez</div>
            </div>
          </div>
          
          <div className="border border-border rounded bg-background p-8 lg:p-12 flex flex-col">
            <BarChart3 className="w-10 h-10 mb-6 text-foreground" />
            <h2 className="text-2xl font-bold tracking-tight mb-4">Turn operational data into delivery intelligence.</h2>
            <p className="text-muted-foreground mb-8 text-sm">
              Executive dashboards for project health, sprint velocity, workload analysis, bug trends, and release reliability.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-auto">
              <div className="border border-border rounded p-4 bg-surface">
                <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-2">Avg Velocity</div>
                <div className="text-2xl font-bold font-mono">86.4</div>
              </div>
              <div className="border border-border rounded p-4 bg-surface">
                <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-2">Bug Ratio</div>
                <div className="text-2xl font-bold font-mono">1.2%</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8 - Workflow */}
        <section className="w-full border-y border-border bg-surface py-20 mb-32 overflow-hidden">
          <div className="px-6 md:px-12 max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight mb-12 text-center">The unified enterprise delivery workflow</h2>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
              {['Plan', 'Assign', 'Build', 'Review', 'Test', 'Secure', 'Release', 'Learn'].map((step, i, arr) => (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-background border border-border rounded flex items-center justify-center font-bold font-mono text-sm mb-3">
                      0{i + 1}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest font-bold">{step}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden md:block flex-1 h-[1px] bg-border mx-2" />
                  )}
                  {i < arr.length - 1 && (
                    <div className="md:hidden w-[1px] h-6 bg-border my-2" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 9 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            Replace disconnected tools with one controlled delivery system.
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
              Talk to Sales
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
