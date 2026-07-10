'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PublicFooter } from '@/components/layout/public-footer';

export default function TermsPage() {
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
          
          {/* Legal Draft Notice */}
          <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 mb-12 flex flex-col gap-2 rounded">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-yellow-500 font-bold">
              <span>✦ Notice</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This terms document is a product draft and must be reviewed by qualified legal counsel before production use.
            </p>
          </div>

          {/* Title block */}
          <section className="mb-12 border-b border-border pb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
            <div className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              <div>Effective Date: [Effective Date]</div>
              <div>Last Updated: [Last Updated Date]</div>
            </div>
          </section>

          {/* Legal Content */}
          <article className="prose prose-sm max-w-3xl text-muted-foreground space-y-8 font-sans leading-relaxed text-sm">
            
            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">1. Acceptance of Terms</h2>
              <p>
                By creating a Handoff account, organizing a workspace, or using any features, you accept these terms of service in full.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">2. Eligibility and Account Registration</h2>
              <p>
                To register for a Handoff account, you must provide valid registration credentials and complete the onboarding verification. You are responsible for safeguarding your credentials.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">3. Organization Workspaces</h2>
              <p>
                Workspaces are managed by designated administrators. Actions taken within an organization workspace are subject to the organization’s access policies and administrator authority.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">4. User Roles and Permissions</h2>
              <p>
                User capabilities within Handoff are restricted based on your assigned role (e.g., Owner, Admin, Team Manager, Developer, QA, Security, Auditor). You agree not to attempt to bypass role-based access controls.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">5. Customer Data and Responsibilities</h2>
              <p>
                You retain ownership of any data, tasks, comments, files, and materials you upload to Handoff. You are responsible for ensuring that your data does not violate third-party rights or applicable laws.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">6. Acceptable Use</h2>
              <p>
                You agree not to use Handoff for any malicious, illegal, or abusive activities, including attempts to compromise infrastructure integrity, spam, or transmit unauthorized materials.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">7. AI Features</h2>
              <p>
                AI-generated outputs are provided as assistive summaries and recommendations. Users remain responsible for reviewing outputs before acting on them.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">8. Third-Party Services</h2>
              <p>
                Handoff may integrate with third-party software (e.g., repository hosts, issue trackers). Use of third-party services is subject to their respective terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">9. Intellectual Property</h2>
              <p>
                Handoff logos, code, design patterns, and proprietary features are the property of Handoff and its developers. You may not copy, reverse engineer, or scrape Handoff without permission.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">10. Confidentiality</h2>
              <p>
                Both parties agree to treat non-public information obtained through the service as confidential and to safeguard it with reasonable measures.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">11. Service Availability</h2>
              <p>
                We strive for continuous workspace access but do not guarantee uninterrupted service. Maintenance periods and updates may cause temporary access limitations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">12. Disclaimers</h2>
              <p>
                The service is provided &quot;as is&quot; and &quot;as available&quot; without warranty of any kind.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">13. Limitation of Liability</h2>
              <p>
                Handoff shall not be liable for any indirect, incidental, special, or consequential damages arising out of your use of the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">14. Suspension and Termination</h2>
              <p>
                We reserves the right to suspend or terminate workspace access for violations of acceptable use guidelines or non-payment of subscription fees.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">15. Changes to These Terms</h2>
              <p>
                We may revise these terms of service draft. Continued use of Handoff after modifications are made constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">16. Governing Law</h2>
              <p>
                These terms are governed by and construed in accordance with the laws of the jurisdiction where Handoff is registered, without regard to conflicts of law principles.
              </p>
            </section>

            <section className="space-y-3 pb-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">17. Contact Information</h2>
              <p>
                If you have questions regarding this terms draft, please contact:
              </p>
              <div className="font-mono text-xs text-foreground mt-2 space-y-1">
                <div>Company: [Legal Company Name]</div>
                <div>Address: [Legal Address]</div>
                <div>Email: [Support Email]</div>
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
