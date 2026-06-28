import React from 'react';
import { cn } from '@/lib/utils';

interface HandoffLogoProps {
  variant?: 'icon' | 'wordmark' | 'compact' | 'inverse';
  size?: number;
  className?: string;
  'aria-label'?: string;
}

// Base SVG for the sharp italic "H" mark. Declared at module scope so its
// identity is stable across renders (see react-hooks/static-components).
const IconSvg = ({ sz }: { sz: number }) => (
  <svg
    width={sz}
    height={sz}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="shrink-0"
  >
    {/* Left stroke */}
    <path d="M8.5 2 L3.5 22 L7.5 22 L12.5 2 Z" />
    {/* Right stroke */}
    <path d="M18.5 2 L13.5 22 L17.5 22 L22.5 2 Z" />
    {/* Diagonal cut bridge */}
    <path d="M6 14.5 L16.5 9.5 L15.5 13 L5 18 Z" />
  </svg>
);

export function HandoffLogo({
  variant = 'icon',
  size = 24,
  className,
  'aria-label': ariaLabel
}: HandoffLogoProps) {
  const containerClasses = cn(
    "flex items-center",
    variant === 'inverse' ? "bg-foreground text-background p-2 rounded-none" : "text-foreground",
    className
  );

  const finalAriaLabel = ariaLabel || "Handoff Logo";

  if (variant === 'icon') {
    return (
      <div className={cn("inline-flex items-center justify-center", className)} aria-label={finalAriaLabel}>
        <IconSvg sz={size} />
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <div className={containerClasses} aria-label={finalAriaLabel}>
        <IconSvg sz={size} />
        <span 
          className="ml-2.5 font-bold uppercase tracking-widest font-mono" 
          style={{ fontSize: Math.max(12, size * 0.6) }}
        >
          Handoff
        </span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={containerClasses} aria-label={finalAriaLabel}>
        <IconSvg sz={size} />
        <span 
          className="ml-2 font-bold uppercase tracking-tighter" 
          style={{ fontSize: Math.max(10, size * 0.5) }}
        >
          HDF
        </span>
      </div>
    );
  }

  if (variant === 'inverse') {
    return (
      <div className={containerClasses} aria-label={finalAriaLabel}>
        <IconSvg sz={size} />
        <span 
          className="ml-2.5 font-bold uppercase tracking-widest font-mono" 
          style={{ fontSize: Math.max(12, size * 0.6) }}
        >
          Handoff
        </span>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center justify-center", className)} aria-label={finalAriaLabel}>
      <IconSvg sz={size} />
    </div>
  );
}
