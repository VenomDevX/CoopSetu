import type { Metadata, Viewport } from 'next';
import { MotionConfig } from 'motion/react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import { RegisterServiceWorker } from '@/components/offline/register-sw';
import { NativeProvider } from '@/components/native/native-provider';
import { getIsNative } from '@/lib/native/server';
import './globals.css';

import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'CoopSetu',
  description: 'Cooperative Training Hub — Digital ERP for training institutions, skill development & employment exchange.',
  manifest: '/manifest.json',
};

// width/initial-scale match what Next already injects by default, so this is
// not a behaviour change for the web. The additions are:
//   viewportFit: 'cover' — required for env(safe-area-inset-*) to return
//     anything but 0, which the native app's chrome depends on. No effect
//     outside a notched fullscreen context.
//   themeColor — colours the system bars in installed PWAs / the native shell.
// Deliberately NO maximumScale/userScalable: pinch-zoom stays available
// everywhere. Input auto-zoom is prevented by a 16px base font in the
// .app-native scope instead, which costs no accessibility.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const locale = await getLocale();
  const messages = await getMessages();
  // Resolved on the server so the native layout is correct on first paint.
  // The class scopes every native-only style rule in globals.css; next-themes
  // only ever add/removes its own theme class, so it won't clobber this one.
  const isNative = await getIsNative();

  return (
    <html
      lang={locale}
      className={isNative ? 'app-native' : undefined}
      suppressHydrationWarning
      nonce={nonce}
    >
      <body className="font-sans bg-background text-foreground antialiased transition-colors duration-200 min-h-[100dvh]" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange={false}
            nonce={nonce}
          >
            <NativeProvider isNative={isNative}>
              <MotionConfig reducedMotion="user">
                <Providers>{children}</Providers>
              </MotionConfig>
            </NativeProvider>
            <RegisterServiceWorker />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
