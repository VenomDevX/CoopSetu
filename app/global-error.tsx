'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'monospace', background: '#0a0a0a', color: '#e5e5e5' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '0.75rem' }}>
            Application error
          </div>
          <p style={{ fontSize: '0.875rem', maxWidth: '28rem' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              border: '1px solid #525252',
              background: 'transparent',
              color: 'inherit',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
