import type { Metadata } from 'next';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import './globals.css';

import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'HANDOFF',
  description: 'Engineering work management for teams that ship critical software.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning nonce={nonce}>
      <body className="font-sans bg-background text-foreground antialiased transition-colors duration-200 min-h-[100dvh]" suppressHydrationWarning>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
