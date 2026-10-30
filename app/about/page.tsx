'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PublicFooter } from '@/components/layout/public-footer';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

export default function AboutPage() {
  const router = useRouter();
  const t = useTranslations('Marketing.about');
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
          
          {/* HERO SECTION */}
          <section className="mb-24 border-b border-border pb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-foreground rounded-full" />
              {t('eyebrow')}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1] max-w-4xl">
              {t('heading')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed">
              {t('intro')}
            </p>
          </section>

          {/* VALUES / SECTIONS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">{t('p1Label')}</span>
              <p className="text-base text-foreground leading-relaxed">
                {t('p1Body')}
              </p>
            </div>

            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">{t('p2Label')}</span>
              <p className="text-base text-foreground leading-relaxed">
                {t('p2Body')}
              </p>
            </div>

            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">{t('p3Label')}</span>
              <p className="text-base text-foreground leading-relaxed">
                {t('p3Body')}
              </p>
            </div>

            <div className="border border-border rounded p-8 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">{t('p4Label')}</span>
              <p className="text-base text-foreground leading-relaxed">
                {t('p4Body')}
              </p>
            </div>

            <div className="border border-border rounded p-8 md:col-span-2 flex flex-col gap-4">
              <span className="font-mono text-xs text-muted-foreground">{t('p5Label')}</span>
              <p className="text-base text-foreground leading-relaxed">
                {t('p5Body')}
              </p>
            </div>
          </section>

          {/* BUILT FOR SEGMENTS */}
          <section className="border border-border rounded py-8 mb-24 overflow-hidden relative flex items-center bg-surface/30">
            <div className="absolute left-0 px-8 py-8 z-10 bg-background/90 backdrop-blur-md border-r border-border h-full flex items-center">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{t('builtFor')}</span>
            </div>
            <div className="flex-1 overflow-hidden flex items-center">
              <motion.div 
                className="flex gap-x-8 text-sm font-mono uppercase tracking-wider text-foreground w-max"
                animate={{ x: [0, "-50%"] }}
                transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
              >
                {(() => { const seg = [t('segInstitutes'), t('segTrainees'), t('segTrainers'), t('segEmployers'), t('segNcct'), t('segCouncils'), t('segAgencies')]; return [...seg, ...seg]; })().map((item, index) => (
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
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-4">{t('builtBy')}</span>
                  <h2 className="text-2xl font-bold tracking-tight mb-3">
                    {t('builtByHeading')}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {t('builtByBody')}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 justify-center border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8 font-mono text-xs uppercase tracking-widest">
                <a 
                  href="https://www.linkedin.com/in/parthsharma-venomdevx" 
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
            <h2 className="text-2xl md:text-3xl font-bold mb-8 uppercase tracking-wide">{t('ctaHeading')}</h2>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button 
                onClick={() => handleNavigate('/dashboard', 'demo')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs w-full sm:w-auto"
                disabled={isNavigating}
              >
                {t('ctaDemo')}
              </Button>
              <Button 
                onClick={() => handleNavigate('/dashboard', 'signup')}
                className="border border-border rounded bg-transparent text-foreground hover:bg-surface rounded h-12 px-8 font-mono uppercase tracking-widest text-xs w-full sm:w-auto"
                disabled={isNavigating}
              >
                {t('ctaRegister')} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button 
                onClick={() => handleNavigate('/dashboard', 'signin')}
                className="text-xs font-mono uppercase tracking-widest hover:text-muted-foreground transition-colors py-3 px-6 w-full sm:w-auto"
              >
                {t('ctaSignIn')}
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
              {t('navigating')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
