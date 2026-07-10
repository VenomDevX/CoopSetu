'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PublicFooter } from '@/components/layout/public-footer';

export default function PrivacyPage() {
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
              This privacy policy is a product draft and must be reviewed by qualified legal counsel before production use.
            </p>
          </div>

          {/* Title block */}
          <section className="mb-12 border-b border-border pb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
            <div className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              <div>Effective Date: [Effective Date]</div>
              <div>Last Updated: [Last Updated Date]</div>
            </div>
          </section>

          {/* Legal Content */}
          <article className="prose prose-sm max-w-3xl text-muted-foreground space-y-8 font-sans leading-relaxed text-sm">
            
            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us when setting up an account, updating your profile, submitting a contact request, or configuring workspace components. This may include your name, email address, company name, and role description.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">2. How We Use Information</h2>
              <p>
                We use collected information to run and secure the Handoff workspace, facilitate team coordination, manage notifications, validate account privileges, and respond to sales or support inquiries.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">3. Organization and Workspace Data</h2>
              <p>
                Organization data, projects, tasks, comments, and attachments are scoped strictly to the respective organization. We do not inspect or leverage this operational data outside of providing workspace services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">4. Authentication and Account Information</h2>
              <p>
                Account creation and authentication are handled securely via cryptographic tokens. Your password is never stored in plain or reversible form — it is one-way hashed (bcrypt) before it touches our database, so even we cannot see or recover it. Password resets use a short-lived, single-use signed link sent to your verified email address. Repeated failed sign-in attempts against an account are automatically throttled.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">5. Cookies and Session Data</h2>
              <p>
                We use security and session cookies to verify your identity, retain user preferences, and prevent cross-site request forgery. Essential cookies cannot be disabled.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">6. AI Features and Workspace Data</h2>
              <p>
                When AI features are enabled, Handoff processes only authorized workspace data required to provide the requested feature. AI access is permission-controlled and organization-scoped.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">7. Data Sharing and Service Providers</h2>
              <p>
                We do not sell customer or workspace data. We share data only with trusted infrastructure providers (e.g., host systems, database providers) required to run the Handoff software.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">8. Data Retention</h2>
              <p>
                We retain account and operational workspace data only as long as your workspace account is active or as necessary to comply with security requirements.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">9. Security Measures</h2>
              <p>
                We implement access control lists, row-level security (RLS), and rate limiting (including account-level lockout on repeated failed logins and a dedicated stricter limit on AI usage) to prevent unauthorized database read/write access. Connected third-party integration credentials (e.g. GitHub access tokens) are encrypted at rest (AES-256-GCM) and are never readable through normal application queries. All traffic is served over HTTPS with a strict Content Security Policy and standard hardening headers (HSTS, X-Frame-Options, X-Content-Type-Options).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">10. Your Rights and Choices</h2>
              <p>
                You may request access to, correction of, or deletion of your personal account information by contacting the workspace administrator or reaching out directly.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">11. International Data Transfers</h2>
              <p>
                Data is transferred and processed in locations where our server infrastructure resides. By using our service, you acknowledge this data transfer.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">12. Changes to This Policy</h2>
              <p>
                We update this privacy policy draft as new features or operational requirements are implemented. We will update the effective date accordingly.
              </p>
            </section>

            <section className="space-y-3 pb-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">13. Contact Information</h2>
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
