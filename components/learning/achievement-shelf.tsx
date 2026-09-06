'use client';

import { Lock } from 'lucide-react';

/**
 * The badge shelf.
 *
 * Locked badges are rendered, not hidden. A shelf that shows only what someone
 * already has tells them nothing about what to do next; the empty slots are
 * the point, and each carries the threshold that opens it.
 */

export interface AchievementRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  tier: string;
  points: number;
  criteria: { metric?: string; threshold?: number } | null;
  unlocked: boolean;
  unlocked_at: string | null;
  unlocked_value: number | null;
}

const TIER_STYLE: Record<string, string> = {
  BRONZE:   'border-orange-500/40 text-orange-500 bg-orange-500/5',
  SILVER:   'border-slate-400/50 text-slate-400 bg-slate-400/5',
  GOLD:     'border-yellow-500/40 text-yellow-500 bg-yellow-500/5',
  PLATINUM: 'border-cyan-400/40 text-cyan-400 bg-cyan-400/5',
};

/** "3 days ago" reads better than a date on something that just happened. */
function whenUnlocked(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function AchievementShelf({ achievements }: { achievements: AchievementRow[] }) {
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const points = achievements.filter((a) => a.unlocked).reduce((a, x) => a + (x.points || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Achievements
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
          {unlocked} / {achievements.length} unlocked · {points} pts
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`border rounded p-4 flex flex-col gap-2 transition-colors ${
              a.unlocked
                ? TIER_STYLE[a.tier] ?? 'border-border text-foreground'
                : 'border-border bg-surface text-muted-foreground'
            }`}
            title={a.description ?? a.name}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`text-2xl leading-none ${a.unlocked ? '' : 'grayscale opacity-40'}`} aria-hidden="true">
                {a.icon || '🏅'}
              </span>
              {a.unlocked
                ? <span className="font-mono text-[9px] uppercase tracking-widest">{a.tier}</span>
                : <Lock className="w-3.5 h-3.5 shrink-0" aria-label="Locked" />}
            </div>

            <div className="text-sm font-bold tracking-tight text-foreground">{a.name}</div>

            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              {a.unlocked
                ? `Unlocked ${whenUnlocked(a.unlocked_at)}`
                : a.criteria?.threshold != null
                  ? `${a.criteria.threshold} ${String(a.criteria.metric ?? '').replace(/_/g, ' ')} to unlock`
                  : (a.description ?? '')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
