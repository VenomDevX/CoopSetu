'use client';

import React from 'react';

/**
 * Reusable workspace layout primitive for data-heavy operational pages.
 * 
 * Behavior:
 * - On desktop (lg and above): Locks the page height to exactly the viewport minus the shell header,
 *   negating the global shell padding so that inner scrolling regions can extend to the edges if needed,
 *   while preserving the padded look for content.
 * - On tablet/mobile (below lg): Falls back to normal vertical page scrolling to prevent trapping
 *   users in nested scroll containers on small screens.
 */
export function WorkspaceDataLayout({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode, 
  className?: string 
}) {
  return (
    <div className={`
      flex flex-col min-h-0 w-full
      lg:h-[calc(100dvh-64px)] lg:-my-8 lg:py-8 lg:-mx-8 lg:px-8 lg:overflow-hidden
      ${className}
    `}>
      {children}
    </div>
  );
}
