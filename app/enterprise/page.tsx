'use client';
import { Logo } from '@/components/logo';

import React from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/components/layout/public-footer';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  CheckCircle2, 
  Loader2,
  Building2,
  BarChart3,
  Network,
  Workflow,
  Blocks,
  Settings2,
  PieChart,
  Bot,
  Terminal,
  Shield,
  Activity,
  GitPullRequest,
  Database,
  ArrowDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EnterprisePage() {
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
              <Link href="/product" className="hover:text-foreground transition-colors">Product</Link>
              <Link href="/solutions" className="hover:text-foreground transition-colors">Solutions</Link>
              <Link href="/ai" className="hover:text-foreground transition-colors">AI</Link>
              <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="/enterprise" className="text-foreground transition-colors">Enterprise</Link>
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
              <Building2 className="w-4 h-4" />
              ENTERPRISE_OPERATIONS
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              Coordinate complex delivery across the entire organization.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              Handoff gives large organizations a controlled system for programs, projects, teams, releases, security, and operational reporting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/contact', 'sales')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Contact Sales
              </Button>
              <Button 
                onClick={() => handleNavigate('/product', 'explore')}
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Explore Platform
              </Button>
            </div>
          </div>

          {/* Hero Visual - Enterprise Command Center */}
          <div className="w-full bg-surface-elevated border border-border rounded p-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-foreground to-transparent opacity-50" />
            
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-4">
                <Building2 className="w-4 h-4 text-foreground" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">Global Delivery Command</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">Updated: Just now</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Left Column: Portfolio & AI */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="border border-border rounded bg-background p-4 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Portfolio Health</div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span>Consumer App</span>
                      <span className="text-emerald-500 font-mono">92%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>B2B Platform</span>
                      <span className="text-orange-500 font-mono">74%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>Data Infrastructure</span>
                      <span className="text-emerald-500 font-mono">98%</span>
                    </div>
                  </div>
                </div>
                
                <div className="border border-accent/20 bg-surface p-4 flex-1 shadow-[0_0_15px_rgba(var(--accent),0.05)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-3 h-3 text-accent" />
                    <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Executive Summary</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Overall delivery velocity is stable at 2,450 pts/sprint. One critical risk identified in the B2B Platform related to cross-team dependencies in the billing module.
                  </p>
                </div>
              </div>

              {/* Middle Column: Programs & Dependencies */}
              <div className="lg:col-span-2 border border-border rounded bg-background p-4 flex flex-col">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Active Programs & Dependencies</div>
                <div className="flex-1 space-y-4">
                   <div className="bg-surface border border-border rounded p-3">
                     <div className="flex justify-between mb-2">
                       <span className="text-xs font-bold uppercase">Q3 Global Expansion</span>
                       <span className="text-[10px] font-mono bg-orange-500/10 text-orange-500 border border-orange-500 px-1">AT RISK</span>
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                       <Network className="w-3 h-3" />
                       Blocked by: EU Data Residency Compliance
                     </div>
                   </div>
                   
                   <div className="bg-surface border border-border rounded p-3">
                     <div className="flex justify-between mb-2">
                       <span className="text-xs font-bold uppercase">Unified Auth Rollout</span>
                       <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500 px-1">ON TRACK</span>
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                       <Network className="w-3 h-3" />
                       Dependencies resolved: Identity Provider Sync
                     </div>
                   </div>
                </div>
              </div>

              {/* Right Column: Capacity & Release Pipeline */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="border border-border rounded bg-background p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Global Capacity</div>
                  <div className="text-2xl font-bold font-mono">94%</div>
                  <div className="w-full h-1 bg-surface mt-2 border border-border rounded overflow-hidden">
                    <div className="h-full bg-foreground w-[94%]" />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 uppercase">12 Teams Overallocated</div>
                </div>

                <div className="border border-border rounded bg-background p-4 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Release Pipeline</div>
                  <div className="space-y-2 text-[10px] font-mono">
                     <div className="flex justify-between items-center bg-surface p-1.5 border border-border rounded">
                       <span>v4.2.0</span>
                       <span className="text-emerald-500">PROD</span>
                     </div>
                     <div className="flex justify-between items-center bg-surface p-1.5 border border-border rounded">
                       <span>v4.3.0-rc1</span>
                       <span className="text-orange-500">UAT</span>
                     </div>
                     <div className="flex justify-between items-center bg-surface p-1.5 border border-border rounded">
                       <span>v4.4.0-alpha</span>
                       <span className="text-muted-foreground">DEV</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 - Built for organizational complexity */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Network className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From one team to hundreds of delivery teams.</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Organizations</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Business units</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Departments</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Teams</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Programs & Portfolios</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Projects</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Cross-project dependencies</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Global roadmaps</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-surface p-8 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2">
                 Structural Hierarchy
               </div>
               
               <div className="flex flex-col gap-1 items-center">
                 {['Organization', 'Department', 'Team', 'Program', 'Project', 'Epic', 'Task'].map((level, i, arr) => (
                   <React.Fragment key={level}>
                     <div className="w-full max-w-[200px] border border-border rounded bg-background p-3 text-center text-xs font-bold font-mono uppercase tracking-widest shadow-sm">
                       {level}
                     </div>
                     {i < arr.length - 1 && (
                       <ArrowDown className="w-4 h-4 text-muted-foreground my-1 opacity-50" />
                     )}
                   </React.Fragment>
                 ))}
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 - Portfolio & Program Control */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-8 shadow-xl relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                Program Dependency Map
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4 relative">
                   <div className="text-xs font-bold mb-1">Mobile App Rewrite</div>
                   <div className="text-[10px] font-mono text-muted-foreground mb-2">Program Alpha</div>
                   <div className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 border border-orange-500 inline-block">BLOCKED BY API V2</div>
                 </div>
                 
                 <div className="flex justify-center">
                   <ArrowDown className="w-4 h-4 text-muted-foreground" />
                 </div>
                 
                 <div className="bg-background border border-border rounded p-4">
                   <div className="text-xs font-bold mb-1">API v2 Gateway</div>
                   <div className="text-[10px] font-mono text-muted-foreground mb-2">Platform Team</div>
                   <div className="w-full h-1.5 bg-surface border border-border rounded">
                     <div className="h-full bg-foreground w-[85%]" />
                   </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">See how every project contributes to the bigger plan.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Portfolio dashboards</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Program management</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Project health</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Budget and effort visibility</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Risk & Milestone tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Cross-project dependency mapping</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Delivery forecasting</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Enterprise Workflow Governance */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Workflow className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Standardize work without forcing every team into the same process.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Project templates</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Workflow templates</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Approval templates</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Custom statuses & fields</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Custom roles</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Custom dashboards</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Department-specific workflows</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Release gates</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Workflow Configuration</span>
                <span>Data Science Team</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Backlog', 'Data Prep', 'Model Training', 'Evaluation', 'Peer Review', 'Productionize'].map((status, i) => (
                  <div key={i} className="bg-surface border border-border rounded px-3 py-1 text-xs font-mono">
                    {status}
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-xs font-bold mb-2">Required Fields</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-mono"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Model Accuracy Target</div>
                  <div className="flex items-center gap-2 text-[10px] font-mono"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Dataset Source Link</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - Enterprise Integrations */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Blocks className="w-10 h-10 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Connect Handoff to the tools your organization already uses.</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { category: 'Source Control', tools: ['GitHub', 'GitLab', 'Bitbucket'] },
              { category: 'CI/CD & DevOps', tools: ['Azure DevOps', 'Jenkins', 'CircleCI'] },
              { category: 'Observability', tools: ['Datadog', 'Sentry', 'New Relic'] },
              { category: 'Operations', tools: ['Slack', 'MS Teams', 'PagerDuty'] },
              { category: 'Design & Docs', tools: ['Figma', 'Confluence', 'Notion'] },
              { category: 'Identity', tools: ['Okta', 'Azure AD', 'OneLogin'] },
              { category: 'Migrations', tools: ['Jira Import', 'Trello Import', 'Asana Import'] },
              { category: 'Custom API', tools: ['REST API', 'Webhooks', 'GraphQL'] },
            ].map((block, i) => (
              <div key={i} className="border border-border rounded bg-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{block.category}</div>
                <div className="space-y-2 text-xs font-bold">
                  {block.tools.map((tool, j) => (
                    <div key={j}>{tool}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5 - Administration at Scale */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-8 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2">
                 Organization Settings
               </div>
               <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4 flex justify-between items-center">
                   <div>
                     <div className="text-sm font-bold">SAML Single Sign-On</div>
                     <div className="text-xs text-muted-foreground">Enforce identity provider login</div>
                   </div>
                   <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                     <div className="absolute right-1 top-1 bg-background w-3 h-3 rounded-full" />
                   </div>
                 </div>
                 <div className="bg-background border border-border rounded p-4 flex justify-between items-center">
                   <div>
                     <div className="text-sm font-bold">AI Data Privacy</div>
                     <div className="text-xs text-muted-foreground">Opt out of model training</div>
                   </div>
                   <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                     <div className="absolute right-1 top-1 bg-background w-3 h-3 rounded-full" />
                   </div>
                 </div>
                 <div className="bg-background border border-border rounded p-4 flex justify-between items-center">
                   <div>
                     <div className="text-sm font-bold">SCIM User Provisioning</div>
                     <div className="text-xs text-muted-foreground">Automate account creation</div>
                   </div>
                   <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                     <div className="absolute right-1 top-1 bg-background w-3 h-3 rounded-full" />
                   </div>
                 </div>
               </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Settings2 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Manage access, teams, and policy from one place.</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> SSO & SCIM</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Role management</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Department admin</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Team provisioning</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Project access policies</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Audit logs</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Security settings</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> AI & Data retention</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - Enterprise Reporting */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <PieChart className="w-10 h-10 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Give every stakeholder the right level of visibility.</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
             <div className="border border-border rounded bg-surface p-6">
               <div className="font-bold mb-4 border-b border-border pb-2">For Executives (CEO, CTO)</div>
               <ul className="space-y-2 text-sm text-muted-foreground">
                 <li>• Executive dashboards</li>
                 <li>• Delivery health reports</li>
                 <li>• Organization-wide velocity</li>
               </ul>
             </div>
             <div className="border border-border rounded bg-surface p-6">
               <div className="font-bold mb-4 border-b border-border pb-2">For Management</div>
               <ul className="space-y-2 text-sm text-muted-foreground">
                 <li>• Scheduled reports</li>
                 <li>• Capacity & allocation reports</li>
                 <li>• Cross-team dependency tracking</li>
               </ul>
             </div>
             <div className="border border-border rounded bg-surface p-6">
               <div className="font-bold mb-4 border-b border-border pb-2">For External / Compliance</div>
               <ul className="space-y-2 text-sm text-muted-foreground">
                 <li>• Exportable PDFs</li>
                 <li>• Client project views</li>
                 <li>• Compliance & Audit reports</li>
               </ul>
             </div>
          </div>
        </section>

        {/* SECTION 7 - Implementation Process */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-y border-border py-20 bg-surface">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-background border border-border rounded flex items-center justify-center font-mono font-bold mx-auto mb-4">1</div>
              <h3 className="font-bold text-lg mb-2">Connect</h3>
              <p className="text-sm text-muted-foreground">Connect teams, repositories, tools, and workspaces.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-background border border-border rounded flex items-center justify-center font-mono font-bold mx-auto mb-4">2</div>
              <h3 className="font-bold text-lg mb-2">Configure</h3>
              <p className="text-sm text-muted-foreground">Set roles, workflows, approval rules, project templates, and reporting.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center font-mono font-bold mx-auto mb-4">3</div>
              <h3 className="font-bold text-lg mb-2">Operate</h3>
              <p className="text-sm text-muted-foreground">Run planning, delivery, approvals, releases, and reporting from one system.</p>
            </div>
          </div>
        </section>

        {/* SECTION 8 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            Bring every delivery function into one operating system.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/contact', 'sales')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              Contact Sales
            </Button>
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              variant="outline"
              className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              Request Enterprise Demo
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
