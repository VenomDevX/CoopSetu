import type { Metadata } from 'next';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'HANDOFF',
  description: 'Engineering work management for teams that ship critical software.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground antialiased transition-colors duration-200 min-h-[100dvh]" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <MotionConfig reducedMotion="user">
            <Providers>{children}</Providers>
          </MotionConfig>
        </ThemeProvider>
      </body>
    </html>
  );
}
