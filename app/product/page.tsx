'use client';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { AiLogo } from '@/components/ai/ai-logo';

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
  Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function ProductPage() {
  const t = useTranslations('Marketing.product');
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
      <MarketingHeader />

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-24">
        {/* HERO SECTION */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              {t('eyebrow')}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              {t('heading')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              {t('intro')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/dashboard', 'explore')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('ctaExplore')}
              </Button>
              <Button 
                onClick={() => handleNavigate('/contact', 'demo')}
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('ctaDemo')}
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
                 <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Active Batch Board</div>
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
                     <AiLogo className="w-3 h-3 text-accent" />
                     <span className="font-mono text-[10px] uppercase tracking-widest font-bold">CoopSetu Insight</span>
                   </div>
                   <p className="text-xs text-muted-foreground">{t('alert')}</p>
                 </div>
                 <div className="border border-border rounded bg-background p-4 flex-1">
                   <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Placement Pipeline</div>
                   <div className="space-y-3">
                     <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                       <span className="text-[10px] font-mono">{t('codeReview')}</span>
                     </div>
                     <div className="w-[1px] h-3 bg-border ml-1.5" />
                     <div className="flex items-center gap-2">
                       <Loader2 className="w-3 h-3 text-accent animate-spin" />
                       <span className="text-[10px] font-mono text-accent font-bold">{t('qaApproval')}</span>
                     </div>
                     <div className="w-[1px] h-3 bg-border border-dashed ml-1.5" />
                     <div className="flex items-center gap-2 opacity-50">
                       <Shield className="w-3 h-3" />
                       <span className="text-[10px] font-mono">{t('secApproval')}</span>
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
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{t('h2Delivery')}</h2>
            <p className="text-muted-foreground max-w-2xl text-lg">
              {t('deliveryBody')}
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
                      <td className="py-4 text-xs">Batch 24</td>
                      <td className="py-4">
                        <div className="w-24 h-1 bg-surface-hover border border-border rounded overflow-hidden">
                          <div className="h-full bg-foreground w-[65%]" />
                        </div>
                      </td>
                      <td className="py-4"><span className="text-[10px] px-2 py-0.5 border border-emerald-500 text-emerald-500 bg-emerald-500/10">{t('onTrack')}</span></td>
                    </tr>
                    <tr>
                      <td className="py-4 font-bold flex items-center gap-2"><div className="w-2 h-2 bg-foreground" /> Payments API v3</td>
                      <td className="py-4 text-xs">Security Review</td>
                      <td className="py-4">
                        <div className="w-24 h-1 bg-surface-hover border border-border rounded overflow-hidden">
                          <div className="h-full bg-foreground w-[90%]" />
                        </div>
                      </td>
                      <td className="py-4"><span className="text-[10px] px-2 py-0.5 border border-orange-500 text-orange-500 bg-orange-500/10">{t('delayed')}</span></td>
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
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('h2Ownership')}</h2>
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
                <span>{t('taskBoard')}</span>
                <span>{t('batch24')}</span>
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

        {/* SECTION 3 - Digital Training */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6">
              <div className="flex justify-between items-end mb-8 border-b border-border pb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Batch Health</div>
                  <div className="text-2xl font-bold mt-1">Batch 42</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Velocity</div>
                  <div className="text-2xl font-mono font-bold text-accent">84 pts</div>
                </div>
              </div>
              
              <div className="space-y-6">
                 <div>
                   <div className="flex justify-between text-xs font-mono uppercase mb-2">
                     <span>{t('capacity')}</span>
                     <span>95%</span>
                   </div>
                   <div className="h-2 w-full bg-background border border-border rounded">
                     <div className="h-full w-[95%] bg-foreground" />
                   </div>
                 </div>
                 <div>
                   <div className="flex justify-between text-xs font-mono uppercase mb-2">
                     <span>{t('carryover')}</span>
                     <span className="text-orange-500">12%</span>
                   </div>
                   <div className="h-2 w-full bg-background border border-border rounded">
                     <div className="h-full w-[12%] bg-orange-500" />
                   </div>
                 </div>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('h2Capacity')}</h2>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Backlog prioritization</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Story points & velocity</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Scope-change detection</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Automated burndown charts</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - Institute Visibility */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('h2Code')}</h2>
            <p className="text-muted-foreground text-lg">
              {t('codeBody')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-border rounded bg-background p-6">
              <GitPullRequest className="w-8 h-8 text-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">{t('prTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('prBody')}</p>
              <div className="text-[10px] font-mono p-2 bg-surface border border-border rounded text-emerald-500">
                MERGED #1042 into main
              </div>
            </div>
            <div className="border border-border rounded bg-background p-6">
              <Terminal className="w-8 h-8 text-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">{t('ciTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('ciBody')}</p>
              <div className="text-[10px] font-mono p-2 bg-surface border border-border rounded flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-accent" />
                {t('buildingWorkflow')}
              </div>
            </div>
            <div className="border border-border rounded bg-background p-6">
              <Layers className="w-8 h-8 text-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">{t('envTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('envBody')}</p>
              <div className="text-[10px] font-mono p-2 bg-surface border border-border rounded text-accent">
                {t('deployedStaging')}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 - Assessments, Security & Placement */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="border border-border rounded bg-surface p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('h2Evidence')}</h2>
                <div className="space-y-4 font-mono text-sm uppercase tracking-widest">
                  <div className="flex items-center gap-3"><Shield className="w-4 h-4 text-muted-foreground" /> Security review checklists</div>
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> QA test plans & bugs</div>
                  <div className="flex items-center gap-3"><Lock className="w-4 h-4 text-muted-foreground" /> Compliance evidence</div>
                  <div className="flex items-center gap-3"><ArrowRight className="w-4 h-4 text-muted-foreground" /> Placement approval chains</div>
                </div>
              </div>
              
              <div className="flex flex-col justify-center gap-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Placement Pipeline Flow</div>
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
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t('h2Knowledge')}</h2>
            <p className="text-muted-foreground mb-8 text-sm">
              {t('knowledgeBody')}
            </p>
            <div className="border border-border rounded bg-surface p-4 text-xs font-mono">
              <div className="text-muted-foreground uppercase tracking-widest text-[10px] mb-2 border-b border-border pb-2">Architecture Decision Record</div>
              <div className="font-bold mb-1">Migrate to Event-Driven Architecture</div>
              <div className="opacity-70">Status: Approved • Author: E. Rodriguez</div>
            </div>
          </div>
          
          <div className="border border-border rounded bg-background p-8 lg:p-12 flex flex-col">
            <BarChart3 className="w-10 h-10 mb-6 text-foreground" />
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t('h2Intelligence')}</h2>
            <p className="text-muted-foreground mb-8 text-sm">
              {t('intelligenceBody')}
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
            <h2 className="text-2xl font-bold tracking-tight mb-12 text-center">{t('h2Workflow')}</h2>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
              {['Enroll', 'Assign', 'Train', 'Review', 'Assess', 'Secure', 'Place', 'Learn'].map((step, i, arr) => (
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
            {t('h2Replace')}
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
              {navType === 'signin' ? t('authenticating') : t('initializing')}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
