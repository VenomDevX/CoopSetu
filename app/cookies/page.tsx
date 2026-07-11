'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PublicFooter } from '@/components/layout/public-footer';

export default function CookiesPage() {
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
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Legal Draft Notice */}
          <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 mb-12 flex flex-col gap-2 rounded">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-yellow-500 font-bold">
              <span>✦ Notice</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This cookie policy is a product draft and must be reviewed by qualified legal counsel before production use.
            </p>
          </div>

          {/* Title block */}
          <section className="mb-12 border-b border-border pb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Cookie Policy</h1>
            <div className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              <div>Effective Date: [Effective Date]</div>
              <div>Last Updated: [Last Updated Date]</div>
            </div>
          </section>

          {/* Legal Content */}
          <article className="prose prose-sm max-w-3xl text-muted-foreground space-y-8 font-sans leading-relaxed text-sm">

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">1. What Cookies Are</h2>
              <p>
                Cookies are small text files stored on your device that let a website recognize your browser between requests. Handoff uses cookies and similar mechanisms (e.g. localStorage) only to operate and secure the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">2. Essential Cookies</h2>
              <p>
                Session and authentication cookies keep you signed in, verify your identity on each request, and protect against cross-site request forgery. These are required for the workspace to function and cannot be disabled.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">3. Preference Cookies</h2>
              <p>
                Some cookies remember workspace preferences, such as your active organization/workspace selection and demo session state, so you don&apos;t have to re-select them on every page load.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">4. What We Do Not Use Cookies For</h2>
              <p>
                We do not use cookies for third-party advertising or cross-site tracking. Legal consent (Terms/Privacy acceptance) is recorded server-side against your account, never stored only in a cookie or local storage.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">5. Managing Cookies</h2>
              <p>
                Most browsers let you clear or block cookies through their settings. Blocking essential cookies will prevent you from signing in or using authenticated features of Handoff.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">6. Changes to This Policy</h2>
              <p>
                We update this cookie policy draft as new features or operational requirements are implemented. We will update the effective date accordingly.
              </p>
            </section>

            <section className="space-y-3 pb-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">7. Contact Information</h2>
              <p>
                For questions regarding this draft policy, please contact:
              </p>
              <div className="font-mono text-xs text-foreground mt-2 space-y-1">
                <div>Company: [Legal Company Name]</div>
                <div>Address: [Legal Address]</div>
                <div>Email: [Privacy Contact Email]</div>
              </div>
            </section>

          </article>

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
