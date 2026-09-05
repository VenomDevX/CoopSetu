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
 *
 * The header height comes from --app-header-h (app/globals.css) rather than a
 * literal, so it stays in step with the shell. Note this only ever applies at
 * lg and up, so on a phone-sized native app the whole lg: block is inert —
 * the variable matters here for large-screen native (Android tablets), not for
 * the phone layout.
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
      lg:h-[calc(100dvh-var(--app-header-h))] lg:-my-8 lg:py-8 lg:-mx-8 lg:px-8 lg:overflow-hidden
      ${className}
    `}>
      {children}
    </div>
  );
}
