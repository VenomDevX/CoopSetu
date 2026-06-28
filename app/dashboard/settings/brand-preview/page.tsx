'use client';

import React from 'react';
import { HandoffLogo } from '@/components/brand/handoff-logo';
import { ChevronRight } from 'lucide-react';

export default function BrandPreviewPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
      {/* Page Header */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <span>Settings</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">Brand Preview</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
          <HandoffLogo variant="icon" size={24} className="mr-2" />
          Brand Preview
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
          Showcase of the Handoff logo system across variants and contexts.
        </p>
      </div>

      <div className="space-y-12">
        {/* 1 & 2. Variants */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest font-mono border-b border-border pb-2">1 & 2. Core Variants</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-border p-6 flex flex-col items-center justify-center gap-4 bg-surface">
              <HandoffLogo variant="icon" size={32} />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Icon Only</span>
            </div>
            <div className="border border-border p-6 flex flex-col items-center justify-center gap-4 bg-surface">
              <HandoffLogo variant="wordmark" size={32} />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Wordmark</span>
            </div>
            <div className="border border-border p-6 flex flex-col items-center justify-center gap-4 bg-surface">
              <HandoffLogo variant="compact" size={32} />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Compact</span>
            </div>
            <div className="border border-border p-6 flex flex-col items-center justify-center gap-4 bg-surface">
              <HandoffLogo variant="inverse" size={32} />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Inverse</span>
            </div>
          </div>
        </section>

        {/* 3 & 4. Light / Dark Modes */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest font-mono border-b border-border pb-2">3 & 4. Contextual Colors (Light & Dark)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Forced Light Mode container */}
            <div className="border border-neutral-300 p-8 flex items-center justify-center bg-white text-neutral-900">
              <div className="flex flex-col items-center gap-4">
                <HandoffLogo variant="wordmark" size={40} />
                <span className="text-[10px] font-mono uppercase text-neutral-500">Light Mode Background</span>
              </div>
            </div>
            {/* Forced Dark Mode container */}
            <div className="border border-neutral-700 p-8 flex items-center justify-center bg-neutral-950 text-white">
              <div className="flex flex-col items-center gap-4">
                <HandoffLogo variant="wordmark" size={40} />
                <span className="text-[10px] font-mono uppercase text-neutral-400">Dark Mode Background</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5, 6, 7. Sizing Contexts */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest font-mono border-b border-border pb-2">5, 6 & 7. Sizing Contexts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Sidebar Size */}
            <div className="border border-border p-4 bg-surface flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <HandoffLogo variant="icon" size={24} />
                <span className="uppercase tracking-widest text-xs font-bold">HANDOFF</span>
              </div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">5. Sidebar / Nav (24px)</span>
            </div>

            {/* Auth Page Size */}
            <div className="border border-border p-4 bg-surface flex flex-col justify-center items-center gap-6">
              <HandoffLogo variant="icon" size={48} />
              <div className="text-center">
                <h3 className="text-xl font-bold">Welcome Back</h3>
              </div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground mt-auto w-full text-center border-t border-border pt-4">6. Auth Page (48px)</span>
            </div>

            {/* Page Heading Size */}
            <div className="border border-border p-4 bg-surface flex flex-col gap-4">
              <h1 className="text-2xl font-bold tracking-tight uppercase flex items-center gap-2">
                <HandoffLogo variant="icon" size={20} />
                UPI REFUND SYSTEM
              </h1>
              <span className="text-[10px] font-mono uppercase text-muted-foreground mt-auto border-t border-border pt-4">7. Page Heading (20px)</span>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
