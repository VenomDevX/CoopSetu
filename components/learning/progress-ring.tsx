'use client';

/**
 * A completion ring.
 *
 * SVG rather than a CSS conic-gradient: the ring needs a rounded cap and a
 * track underneath it, and both come free with stroke-dasharray. The colour is
 * `currentColor`, so a caller tints the ring by setting a text colour on the
 * wrapper — which is how the grade colours from lib/lms/grade reach it.
 */
interface Props {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}

export function ProgressRing({ value, size = 120, stroke = 10, label, className = '' }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Dash offset counts backwards from a full circle, so 0% is a full offset.
  const offset = circumference * (1 - pct / 100);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          // Animates on mount from the CSS transition alone; respecting
          // reduced motion is handled globally in the stylesheet.
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tighter tabular-nums text-foreground">{pct}%</span>
        {label && (
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">{label}</span>
        )}
      </div>
    </div>
  );
}
