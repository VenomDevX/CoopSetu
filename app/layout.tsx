import type { Metadata } from 'next';
import { MotionConfig } from 'motion/react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import { RegisterServiceWorker } from '@/components/offline/register-sw';
import './globals.css';

import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'CoopSetu',
  description: 'Cooperative Training Hub — Digital ERP for training institutions, skill development & employment exchange.',
  manifest: '/manifest.json',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning nonce={nonce}>
      <body className="font-sans bg-background text-foreground antialiased transition-colors duration-200 min-h-[100dvh]" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange={false}
            nonce={nonce}
          >
            <MotionConfig reducedMotion="user">
              <Providers>{children}</Providers>
            </MotionConfig>
            <RegisterServiceWorker />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
