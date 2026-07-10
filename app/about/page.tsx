'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PublicFooter } from '@/components/layout/public-footer';
import { motion } from 'motion/react';

export default function AboutPage() {
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
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* HERO SECTION */}
          <section className="mb-24 border-b border-border pb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-foreground rounded-full" />
              ABOUT_HANDOFF
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1] max-w-4xl">
              Operational clarity for teams building critical software.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed">
              Handoff is a role-aware workspace for planning work, assigning teams, managing delivery, tracking approvals, and keeping project data connected in real time.
            </p>
          </section>

          {/* VALUES / SECTIONS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">01 — WHAT HANDOFF DOES</span>
              <p className="text-base text-foreground leading-relaxed">
                Project, task, sprint, team, QA, security, approval, and release coordination in one controlled workspace.
              </p>
            </div>

            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">02 — BUILT FOR ACCOUNTABILITY</span>
              <p className="text-base text-foreground leading-relaxed">
                Every action is connected to the right organization, project, team, role, and audit trail.
              </p>
            </div>

            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">03 — ROLE-AWARE BY DESIGN</span>
              <p className="text-base text-foreground leading-relaxed">
                Owners, Admins, Project Managers, Team Managers, Developers, QA, Security, Auditors, and Client Viewers see only what they are authorized to access.
              </p>
            </div>

            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">04 — REALTIME DELIVERY OPERATIONS</span>
              <p className="text-base text-foreground leading-relaxed">
                Task assignments, updates, comments, notifications, workload, blockers, and delivery signals update without manual refresh.
              </p>
            </div>

            <div className="border border-border rounded p-8 md:col-span-2 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">05 — TRUSTED DATA, NOT FABRICATED DASHBOARDS</span>
              <p className="text-base text-foreground leading-relaxed">
                Show truthful data and accurate empty states. Do not invent projects, employees, alerts, metrics, or delivery risks.
              </p>
            </div>
          </section>

          {/* BUILT FOR SEGMENTS */}
          <section className="border border-border rounded py-8 mb-24 overflow-hidden relative flex items-center bg-surface/30">
            <div className="absolute left-0 px-8 py-8 z-10 bg-background/90 backdrop-blur-md border-r border-border h-full flex items-center">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">BUILT FOR</span>
            </div>
            <div className="flex-1 overflow-hidden flex items-center">
              <motion.div 
                className="flex gap-x-8 text-sm font-mono uppercase tracking-wider text-foreground w-max"
                animate={{ x: [0, "-50%"] }}
                transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
              >
                {[...['Technology', 'Fintech', 'SaaS', 'Engineering Organizations', 'Product Teams', 'QA & Security Teams', 'Operations Teams'], ...['Technology', 'Fintech', 'SaaS', 'Engineering Organizations', 'Product Teams', 'QA & Security Teams', 'Operations Teams']].map((item, index) => (
                  <div key={index} className="flex items-center gap-x-8 whitespace-nowrap">
                    <span>{item}</span>
                    <span className="text-border">/</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* DEVELOPER SECTION */}
          <section className="border border-border rounded p-8 mb-24 bg-surface/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 flex flex-col justify-between gap-4">
                <div>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-4">BUILT_BY</span>
                  <h2 className="text-2xl font-bold tracking-tight mb-3">
                    Handoff is designed and developed by VenomDevX.
                  </h2>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    Focused on building secure, role-aware workflow software for teams managing complex software delivery.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 justify-center border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8 font-mono text-xs uppercase tracking-widest">
                <a 
                  href="https://www.linkedin.com/in/parth-sharma-b96661245" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label="LinkedIn Profile of VenomDevX"
                  className="hover:text-foreground text-muted-foreground transition-colors flex items-center justify-between py-1"
                >
                  <span>LinkedIn</span>
                  <span className="text-muted-foreground/45">→</span>
                </a>
                <a 
                  href="https://github.com/VenomDevX" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label="GitHub Profile of VenomDevX"
                  className="hover:text-foreground text-muted-foreground transition-colors flex items-center justify-between py-1"
                >
                  <span>GitHub</span>
                  <span className="text-muted-foreground/45">→</span>
                </a>
                <a 
                  href="https://www.venomdevx.dev/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label="Portfolio of VenomDevX"
                  className="hover:text-foreground text-muted-foreground transition-colors flex items-center justify-between py-1"
                >
                  <span>Portfolio</span>
                  <span className="text-muted-foreground/45">→</span>
                </a>
              </div>
            </div>
          </section>

          {/* CALL TO ACTION */}
          <section className="text-center border-t border-border pt-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 uppercase tracking-wide">Ready to gain operational clarity?</h2>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button 
                onClick={() => handleNavigate('/dashboard', 'demo')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs w-full sm:w-auto"
                disabled={isNavigating}
              >
                Request a Demo
              </Button>
              <Button 
                onClick={() => handleNavigate('/dashboard', 'signup')}
                className="border border-border rounded bg-transparent text-foreground hover:bg-surface rounded h-12 px-8 font-mono uppercase tracking-widest text-xs w-full sm:w-auto"
                disabled={isNavigating}
              >
                Create Workspace <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button 
                onClick={() => handleNavigate('/dashboard', 'signin')}
                className="text-xs font-mono uppercase tracking-widest hover:text-muted-foreground transition-colors py-3 px-6 w-full sm:w-auto"
              >
                Sign In
              </Button>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <PublicFooter />

      {/* Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface border border-border rounded p-8 flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
            <Loader2 className="w-8 h-8 text-foreground animate-spin mb-6" />
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Navigating to workspace...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
