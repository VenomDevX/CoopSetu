'use client';

import React, { useState } from 'react';
import { Button, ButtonProps } from './button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MockActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  icon: React.ElementType;
  label: string;
  successLabel?: string;
  delayMs?: number;
}

export function MockActionButton({
  icon: Icon,
  label,
  successLabel = 'Completed',
  delayMs = 1500,
  variant = 'outline',
  className,
  ...props
}: MockActionButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleClick = () => {
    if (state !== 'idle') return;
    
    setState('loading');
    setTimeout(() => {
      setState('success');
      setTimeout(() => {
        setState('idle');
      }, 3000);
    }, delayMs);
  };

  return (
    <Button
      variant={state === 'success' ? 'outline' : variant}
      className={cn("h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest gap-0", className, state === 'success' && 'border-emerald-500/30')}
      onClick={handleClick}
      disabled={state === 'loading'}
      {...props}
    >
      {state === 'idle' && (
        <>
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
      {state === 'loading' && (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing...
        </>
      )}
      {state === 'success' && (
        <>
          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
          <span className="text-foreground">{successLabel}</span>
        </>
      )}
    </Button>
  );
}
