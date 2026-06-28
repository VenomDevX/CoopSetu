'use client';

import React from 'react';

/**
 * Reusable viewport container for data panels (tables, lists, boards).
 * Automatically takes up remaining vertical space via flex-1 and adds inner scroll.
 */
export function DataViewport({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode, 
  className?: string 
}) {
  return (
    <div className={`flex-1 min-h-0 overflow-auto bg-background border border-border scrollbar-thin flex flex-col ${className}`}>
      {children}
    </div>
  );
}
