import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-background py-12 px-6 md:px-12 mt-auto text-xs text-muted-foreground font-mono uppercase tracking-widest w-full">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          
          <div className="flex flex-col gap-6 md:w-1/3">
            <div className="flex items-start gap-4">
              <Logo width={20} height={20} className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-foreground">HANDOFF // 2026</span>
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
              Operational clarity for teams building critical software. A role-aware workspace for planning work, assigning teams, managing delivery, and tracking approvals.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-16 w-full md:w-auto">
            <div className="flex flex-col gap-4">
              <span className="text-foreground font-bold mb-2">Platform</span>
              <Link href="/product" className="hover:text-foreground transition-colors">Product</Link>
              <Link href="/solutions" className="hover:text-foreground transition-colors">Solutions</Link>
              <Link href="/ai" className="hover:text-foreground transition-colors">AI</Link>
              <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="/enterprise" className="hover:text-foreground transition-colors">Enterprise</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-foreground font-bold mb-2">Company</span>
              <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-foreground font-bold mb-2">App</span>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Request Demo</Link>
            </div>
          </div>
          
        </div>
      </div>
    </footer>
  );
}
