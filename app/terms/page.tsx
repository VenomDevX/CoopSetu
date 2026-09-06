'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { PublicFooter } from '@/components/layout/public-footer';

export default function TermsPage() {
  const t = useTranslations('Marketing.legal');
  const locale = useLocale();
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
          {/* Hindi readers get the headings and chrome translated, but the
              operative legal text stays English on purpose: a machine
              translation of contractual language can misstate obligations, and
              only one version can govern. This banner says which one does. */}
          {locale !== 'en' && (
            <div className="border border-border bg-surface/50 p-4 mb-8 rounded">
              <p className="text-xs text-muted-foreground leading-relaxed">{t('translationNotice')}</p>
            </div>
          )}

          
          {/* Legal Draft Notice */}
          <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 mb-12 flex flex-col gap-2 rounded">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-yellow-500 font-bold">
              <span>{t('notice')}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This terms document is a legal draft and must be reviewed by qualified legal counsel before production use.
            </p>
          </div>

          {/* Title block */}
          <section className="mb-12 border-b border-border pb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{t('termsTitle')}</h1>
            <div className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              <div>Effective Date: [Effective Date]</div>
              <div>Last Updated: [Last Updated Date]</div>
            </div>
          </section>

          {/* Legal Content */}
          <article className="prose prose-sm max-w-3xl text-muted-foreground space-y-8 font-sans leading-relaxed text-sm">
            
            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms1')}</h2>
              <p>
                By creating a CoopSetu account, organizing a workspace, or using any features, you accept these terms of service in full.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms2')}</h2>
              <p>
                To register for a CoopSetu account, you must provide valid registration credentials and complete the onboarding verification. You are responsible for safeguarding your credentials.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms3')}</h2>
              <p>
                Workspaces are managed by designated administrators. Actions taken within an organization workspace are subject to the organization’s access policies and administrator authority.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms4')}</h2>
              <p>
                User capabilities within CoopSetu are restricted based on your assigned role (e.g., NCCT Admin, Institute Admin, Trainer, Trainee, Employer). You agree not to attempt to bypass role-based access controls.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms5')}</h2>
              <p>
                You retain ownership of any data, tasks, comments, files, and materials you upload to CoopSetu. You are responsible for ensuring that your data does not violate third-party rights or applicable laws.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms6')}</h2>
              <p>
                You agree not to use CoopSetu for any malicious, illegal, or abusive activities, including attempts to compromise infrastructure integrity, spam, or transmit unauthorized materials.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms7')}</h2>
              <p>
                AI-generated outputs are provided as assistive summaries and recommendations. Users remain responsible for reviewing outputs before acting on them.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms8')}</h2>
              <p>
                CoopSetu may integrate with third-party software (e.g., LMS platforms, state portals, payment gateways). Use of third-party services is subject to their respective terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms9')}</h2>
              <p>
                CoopSetu logos, workflows, design patterns, and proprietary features are the property of CoopSetu. You may not copy, reverse engineer, or scrape CoopSetu without permission.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms10')}</h2>
              <p>
                Both parties agree to treat non-public information obtained through the service as confidential and to safeguard it with reasonable measures.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms11')}</h2>
              <p>
                We strive for continuous workspace access but do not guarantee uninterrupted service. Maintenance periods and updates may cause temporary access limitations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms12')}</h2>
              <p>
                The service is provided &quot;as is&quot; and &quot;as available&quot; without warranty of any kind.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms13')}</h2>
              <p>
                CoopSetu shall not be liable for any indirect, incidental, special, or consequential damages arising out of your use of the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms14')}</h2>
              <p>
                We reserves the right to suspend or terminate workspace access for violations of acceptable use guidelines or non-payment of subscription fees.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms15')}</h2>
              <p>
                We may revise these terms of service draft. Continued use of CoopSetu after modifications are made constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms16')}</h2>
              <p>
                These terms are governed by and construed in accordance with the laws of the jurisdiction where CoopSetu is registered, without regard to conflicts of law principles.
              </p>
            </section>

            <section className="space-y-3 pb-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t('terms17')}</h2>
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
