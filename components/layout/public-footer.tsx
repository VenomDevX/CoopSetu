'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/logo';
import { useIsNative } from '@/components/native/native-provider';

export function PublicFooter() {
  const tNav = useTranslations('Marketing.nav');
  const t = useTranslations('Marketing.footer');
  const tHdr = useTranslations('Marketing.header');
  const isNative = useIsNative();

  // The app doesn't need a sitemap footer — its navigation is the bottom tab
  // bar. What it does need is the legal links to stay reachable (Play Store
  // requires it), so those survive as a compact row that clears the gesture
  // bar via --safe-bottom.
  if (isNative) {
    return (
      <footer
        data-testid="native-public-footer"
        className="border-t border-border bg-background px-4 py-6 mt-auto w-full
                   text-[10px] text-muted-foreground font-mono uppercase tracking-widest
                   pb-[calc(1.5rem+var(--safe-bottom))]"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/privacy" data-native-tap className="hover:text-foreground transition-colors">{tNav('privacy')}</Link>
          <Link href="/terms" data-native-tap className="hover:text-foreground transition-colors">{tNav('terms')}</Link>
          <Link href="/cookies" data-native-tap className="hover:text-foreground transition-colors">{tNav('cookies')}</Link>
          <Link href="/contact" data-native-tap className="hover:text-foreground transition-colors">{tNav('contact')}</Link>
        </div>
        <p className="mt-4 text-foreground font-bold">CoopSetu // 2026</p>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border bg-background py-12 px-6 md:px-12 mt-auto text-xs text-muted-foreground font-mono uppercase tracking-widest w-full">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          
          <div className="flex flex-col gap-6 md:w-1/3">
            <div className="flex items-start gap-4">
              <Logo width={20} height={20} className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-foreground">CoopSetu // 2026</span>
                <a 
                  href="https://github.com/VenomDevX" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-light text-muted-foreground/60 tracking-wider font-mono uppercase hover:text-foreground transition-colors"
                >
                  built by VenomDevX
                </a>
              </div>
            </div>
            <p className="normal-case font-sans tracking-normal text-muted-foreground/80 leading-relaxed max-w-sm">
              A role-aware workspace for training institutes — batches, attendance, assessments, certification, and employer placement in one connected system.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-16 w-full md:w-auto">
            <div className="flex flex-col gap-4">
              <span className="text-foreground font-bold mb-2">{t('platform')}</span>
              <Link href="/product" className="hover:text-foreground transition-colors">{tNav('product')}</Link>
              <Link href="/solutions" className="hover:text-foreground transition-colors">{tNav('solutions')}</Link>
              <Link href="/ai" className="hover:text-foreground transition-colors">AI</Link>
              <Link href="/security" className="hover:text-foreground transition-colors">{tNav('security')}</Link>
              <Link href="/enterprise" className="hover:text-foreground transition-colors">{tNav('enterprise')}</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">{tNav('pricing')}</Link>
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-foreground font-bold mb-2">{t('company')}</span>
              <Link href="/about" className="hover:text-foreground transition-colors">{tNav('about')}</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">{tNav('contact')}</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">{tNav('privacy')}</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">{tNav('terms')}</Link>
              <Link href="/cookies" className="hover:text-foreground transition-colors">{tNav('cookies')}</Link>
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-foreground font-bold mb-2">{t('app')}</span>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">{tHdr('signIn')}</Link>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">{tHdr('requestDemo')}</Link>
            </div>
          </div>
          
        </div>
      </div>
    </footer>
  );
}
