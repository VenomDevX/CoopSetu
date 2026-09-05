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
              SOLUTIONS_BY_ROLE
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              Built for every stakeholder responsible for cooperative training.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              From curriculum planning to final placement, CoopSetu gives every training function a shared operating system.
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
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Give NCCT leaders a real-time view of training delivery.</h2>
              </div>
              <p className="text-muted-foreground mb-8 text-lg">
                Stop guessing about batch schedules and institute capacity. Get out of disconnected tools and into a unified national view.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> No batch visibility</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> Unclear institute capacity</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> Delayed certifications</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> Disconnected assessment tools</div>
              </div>

              <div className="space-y-4 font-mono text-sm uppercase tracking-widest">
                <div className="text-[10px] text-accent font-bold mb-4">CoopSetu SOLUTION</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> National dashboards</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Institute health scoring</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cross-institute benchmarking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> CoopSetu AI placement summaries</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-4 relative shadow-xl">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-surface-hover rounded-tr-[100px] pointer-events-none -z-10" />
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>National Portfolio</span>
                <span>Q3 Placements</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-surface p-4 border border-border rounded">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Total Trainees</div>
                  <div className="text-2xl font-bold">12,400</div>
                </div>
                <div className="bg-surface p-4 border border-border rounded">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Institutes at Risk</div>
                  <div className="text-2xl font-bold text-orange-500">3</div>
                </div>
              </div>
              <div className="bg-surface p-4 border border-border rounded">
                 <div className="text-[10px] uppercase text-muted-foreground mb-3 font-bold">Strategic Programs</div>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center border-b border-border pb-2">
                     <span className="text-xs font-bold">Rural Banking Diploma</span>
                     <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 border border-emerald-500">HEALTHY</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold">Agri-Tech Certification</span>
                     <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 border border-orange-500">AT RISK</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 - Institute Admins */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                Curriculum & Batches
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4 flex gap-4 items-center">
                   <div className="w-8 h-8 bg-surface border border-border rounded flex items-center justify-center font-bold">Q3</div>
                   <div className="flex-1">
                     <div className="text-sm font-bold mb-1">New Banking Module</div>
                     <div className="w-full h-1.5 bg-surface border border-border rounded"><div className="h-full bg-foreground w-[40%]" /></div>
                   </div>
                 </div>
                 <div className="pl-12 space-y-2">
                    <div className="bg-background border border-border rounded p-3 flex justify-between items-center text-xs">
                      <span>Schedule Guest Lectures</span>
                      <span className="font-mono text-[10px] text-muted-foreground">IN PROGRESS</span>
                    </div>
                    <div className="bg-background border border-border rounded p-3 flex justify-between items-center text-xs">
                      <span>Finalize Assessment Papers</span>
                      <span className="font-mono text-[10px] text-muted-foreground">BACKLOG</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Briefcase className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Turn curriculum into clear, accountable training.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Syllabi & Batches</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Modules and sessions</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Batch scheduling</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Assessment tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> AI question generation</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Trainers */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Manage trainee performance before assessments.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Trainee attendance & Grades</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Competency mapping</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Intervention recommendations</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Dropout risk detection</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Learning gap identification</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2 flex justify-between">
                <span>Trainee Performance</span>
                <span>Batch A</span>
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

        {/* SECTION 4 - Trainees */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                Trainee Workspace
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4">
                   <div className="flex justify-between items-start mb-4">
                     <div className="text-sm font-bold">Complete Module 4 Assignment</div>
                     <span className="text-[10px] font-mono border border-border rounded px-2 py-0.5 bg-surface">IN PROGRESS</span>
                   </div>
                   <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground mt-4 pt-4 border-t border-border">
                     <span className="flex items-center gap-1"><GitPullRequest className="w-3 h-3" /> Assignment Submitted</span>
                     <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> Auto-graded: 85%</span>
                   </div>
                 </div>
                 
                 <div className="border border-accent/30 bg-accent/5 p-3 flex gap-3">
                   <AiLogo className="w-4 h-4 text-accent flex-shrink-0" />
                   <div>
                     <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-1">CoopSetu Summary</div>
                     <p className="text-[10px] leading-relaxed text-muted-foreground">Good work on the assignment. Make sure to review the feedback on question 3 to improve your understanding of cooperative banking.</p>
                   </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Terminal className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Keep schedules, learning, assessments, and certifications connected.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> My Learning dashboard</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Linked course materials</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Live attendance tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Assignment feedback</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> AI study summaries</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 - Assessors */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Make skills visible before placement.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Assessment plans & rubrics</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Grade & feedback tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Moderation workflows</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Certification readiness checks</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> AI-generated question banks</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Assessment: Batch A Final</span>
                <span className="text-orange-500 font-bold">1 PENDING</span>
              </div>
              <div className="space-y-3">
                 <div className="bg-surface border border-border rounded p-3 flex items-center justify-between">
                   <span className="text-xs font-bold">Theory Section</span>
                   <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500 px-2 bg-emerald-500/10">PASSED</span>
                 </div>
                 <div className="bg-surface border border-border rounded p-3 flex items-center justify-between">
                   <span className="text-xs font-bold">Practical Viva</span>
                   <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500 px-2 bg-emerald-500/10">PASSED</span>
                 </div>
                 <div className="bg-background border border-orange-500 p-3 flex flex-col gap-2">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold">Project Submission</span>
                     <span className="text-[10px] font-mono text-orange-500 border border-orange-500 px-2 bg-orange-500/10">NEEDS REVIEW</span>
                   </div>
                   <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Plagiarism score above threshold</div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - State Registries & NCCT */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Affiliation Review Gate</span>
                <span className="text-accent font-bold">PENDING</span>
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4">
                   <div className="text-sm font-bold mb-3">Institute Renewal Requirements</div>
                   <div className="space-y-2">
                     <div className="flex items-center gap-3 text-xs">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Infrastructure Audit Passed
                     </div>
                     <div className="flex items-center gap-3 text-xs">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Faculty Ratio Verified
                     </div>
                     <div className="flex items-center gap-3 text-xs">
                       <div className="w-4 h-4 border border-border rounded bg-surface" /> Manual Inspection Signoff Required
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
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Build affiliation and compliance into the ecosystem.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Affiliation review workflows</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Grievance management</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Inspection gates & audit logs</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Compliance evidence collection</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7 - Placement Partners */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Layers className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Connect training outcomes to industry reality.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Placement pipeline visibility</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Employer tracking</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Job offer approvals</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Interview scheduling workflows</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Skill passports</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Placements</span>
                <span>Hired</span>
              </div>
              <div className="space-y-3">
                 <div className="bg-surface border border-border rounded p-3">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold">Senior Analyst Role</span>
                     <span className="text-[10px] font-mono text-emerald-500">OFFER ACCEPTED</span>
                   </div>
                   <div className="text-[10px] font-mono text-muted-foreground flex gap-4">
                     <span>Accepted 2h ago</span>
                     <span>Candidate: S. Jenkins</span>
                   </div>
                 </div>
                 <div className="bg-background border border-border rounded p-3 opacity-70">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold">Branch Manager Role</span>
                     <span className="text-[10px] font-mono text-muted-foreground">REJECTED</span>
                   </div>
                   <div className="text-[10px] font-mono text-muted-foreground flex gap-4">
                     <span>Interviewed yesterday</span>
                     <span>Candidate: System</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8 - National Cooperatives */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="bg-surface border border-border rounded p-8 lg:p-16 text-center max-w-5xl mx-auto shadow-2xl">
            <Lock className="w-12 h-12 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Control training where accountability matters.</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
              Designed for national federations, CoopSetu supports strict affiliation workflows for multi-state cooperatives and government programs.
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
            One platform. Every stakeholder. Clear accountability.
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
