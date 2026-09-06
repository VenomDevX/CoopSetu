'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import {
  ArrowRight, Award, BarChart3, BookOpen, Briefcase, Loader2,
  QrCode, ShieldCheck, Target, UserCheck,
} from 'lucide-react';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { PublicFooter } from '@/components/layout/public-footer';

/**
 * The landing page as rendered inside the Capacitor Android app.
 *
 * Not a narrowed copy of components/marketing/web-landing.tsx — that page is
 * 1200 lines built around desktop affordances that actively fight a phone:
 * scroll-linked parallax (useScroll/useTransform), a 3D-perspective dashboard
 * mock, an interactive expanding three-panel architecture grid, an SVG world
 * map, and two infinite marquees. On a mid-range Android WebView those are a
 * scroll-jank tax paid for effects nobody can see at 390px.
 *
 * This keeps the same copy, the same palette and the same claims, restructured
 * as a stacked single-column read with tap-sized actions. Entrance animations
 * are one-shot fades — no scroll listeners, no transforms driven by scroll
 * position.
 */

// Copy lives in messages/{en,hi}.json under Marketing.landing; only the icon
// and the numeral stay here. The numerals are deliberately untranslated —
// '25K+' and '99.9%' read the same in both locales.
const CAPABILITIES = [
  { icon: UserCheck, key: 'TraineeRegistry' },
  { icon: QrCode, key: 'QrAttendance' },
  { icon: BookOpen, key: 'Courses' },
  { icon: Award, key: 'Certificates' },
  { icon: Target, key: 'SkillPassport' },
  { icon: Briefcase, key: 'Employment' },
] as const;

const METRICS = [
  { v: '25K+', key: 'metricTraineesCertified' },
  { v: '99.9%', key: 'metricUptime' },
  { v: '200+', key: 'metricInstitutions' },
  { v: '100%', key: 'metricDigitalRecords' },
] as const;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

export function NativeLanding() {
  const router = useRouter();
  const t = useTranslations('Marketing.landing');
  const [isNavigating, setIsNavigating] = useState(false);

  const go = (path: string) => {
    setIsNavigating(true);
    router.push(path);
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground font-sans">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 pt-10 pb-12 border-b border-border">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl font-bold tracking-tighter uppercase leading-[0.95]"
          >
            <span className="block">{t('heroTrain')}</span>
            <span className="block text-muted-foreground">{t('heroCertify')}</span>
            <span className="flex items-center">
              {t('heroEmploy')}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block w-2.5 h-10 bg-accent ml-3"
              />
            </span>
          </motion.h1>

          <div className="mt-7 pt-7 border-t border-border relative">
            <div className="absolute -top-[1px] left-0 w-12 h-[1px] bg-accent" />
            <p className="text-base text-muted-foreground leading-relaxed font-light">
              {t('heroBody')}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => go('/dashboard')}
              disabled={isNavigating}
              data-native-tap
              className="w-full rounded-lg bg-foreground text-background font-mono text-xs uppercase tracking-widest
                         flex items-center justify-center gap-2 disabled:opacity-50 px-6"
            >
              {isNavigating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('ctaInitialize')}
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              href="/product"
              data-native-tap
              className="w-full rounded-lg border border-border text-foreground font-mono text-xs uppercase tracking-widest
                         flex items-center justify-center px-6"
            >
              {t('ctaExplore')}
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {([t('chipInstitutions'), t('chipCertificates'), t('chipAttendance'), t('chipPassport')] as const).map((chip) => (
              <div key={chip} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent shrink-0" />
                <span className="truncate">{chip}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Metrics — the web page's social-proof strip, stacked 2x2 */}
        <section className="border-b border-border">
          <div className="grid grid-cols-2 gap-[1px] bg-border">
            {METRICS.map((m) => (
              <div key={m.key} className="bg-background p-5">
                <div className="text-2xl font-bold tracking-tighter mb-1">{m.v}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(m.key)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="px-5 py-12 border-b border-border">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              <span className="w-2 h-2 bg-accent" /> {t('sectionCore')}
            </div>
            <h2 className="text-3xl font-bold tracking-tighter uppercase leading-[0.95] mb-3">
              {t('empowerLine1')}<br />{t('empowerLine2')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('empowerBody')}
            </p>
          </motion.div>

          <div className="mt-8 space-y-3">
            {CAPABILITIES.map((c) => (
              <motion.div
                key={c.key}
                {...fadeUp}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-9 h-9 rounded-md border border-border flex items-center justify-center text-accent shrink-0">
                    <c.icon className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold uppercase tracking-wide text-sm">{t(`cap${c.key}`)}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`cap${c.key}Desc`)}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trust — the architecture section's substance without the interactive panels */}
        <section className="px-5 py-12 border-b border-border">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              <span className="w-2 h-2 bg-accent" /> {t('sectionArchitecture')}
            </div>
            <h2 className="text-3xl font-bold tracking-tighter uppercase leading-[0.95] mb-6">
              {t('trustedLine1')}<br />{t('trustedLine2')}
            </h2>
          </motion.div>

          <div className="space-y-3">
            {[
              { icon: ShieldCheck, key: 'Integrity' },
              { icon: BarChart3, key: 'Sync' },
              { icon: Award, key: 'Verifiable' },
            ].map((item) => (
              <motion.div
                key={item.key}
                {...fadeUp}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <item.icon className="w-4 h-4 text-accent shrink-0" />
                  <h3 className="font-bold uppercase tracking-wide text-sm">{t(`trust${item.key}`)}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`trust${item.key}Desc`)}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Close */}
        <section className="px-5 py-12">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-bold tracking-tighter uppercase leading-[0.95] mb-3">
              {t('startLine1')}<br />{t('startLine2')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-7">
              {t('startBody')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => go('/signup')}
                disabled={isNavigating}
                data-native-tap
                className="w-full rounded-lg bg-accent text-white font-mono text-xs uppercase tracking-widest
                           flex items-center justify-center gap-2 disabled:opacity-50 px-6"
              >
                {t('ctaRegister')}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => go('/login')}
                disabled={isNavigating}
                data-native-tap
                className="w-full rounded-lg border border-border text-foreground font-mono text-xs uppercase tracking-widest
                           flex items-center justify-center px-6"
              >
                {t('ctaSignIn')}
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
