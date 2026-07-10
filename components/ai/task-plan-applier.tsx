'use client';

import { useState, useMemo } from 'react';
import { CheckSquare, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface Props {
  answer: string;
  taskId: string;
  onApplied?: () => void;
}

export function TaskPlanApplier({ answer, taskId, onApplied }: Props) {
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse list items from markdown
  const items = useMemo(() => {
    if (!answer) return [];
    const lines = answer.split('\n');
    const parsed: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Match markdown lists: "- item", "* item", "1. item"
      const match = trimmed.match(/^[-*]\s+(.+)$/i) || trimmed.match(/^\d+\.\s+(.+)$/i);
      if (match && match[1]) {
        // clean up bold markers or other simple markdown from the item if desired,
        // but for now just take the text.
        parsed.push(match[1].replace(/\*\*/g, '').trim());
      }
    }
    return parsed;
  }, [answer]);

  if (items.length === 0) return null;

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/apply-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        throw new Error('Failed to apply plan');
      }

      setApplied(true);
      router.refresh();
      if (onApplied) onApplied();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mt-6 border border-border rounded bg-surface p-4">
      <h3 className="font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2 mb-4">
        <CheckSquare className="w-4 h-4 text-accent" />
        Proposed Checklist ({items.length})
      </h3>
      
      <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto pr-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
            <div className="mt-0.5 w-3 h-3 rounded-sm border border-border rounded flex-shrink-0" />
            <span className="leading-tight">{item}</span>
          </div>
        ))}
      </div>

      {error && <div className="text-xs text-destructive mb-3">{error}</div>}

      <Button
        onClick={handleApply}
        disabled={applying || applied}
        className="w-full h-9 rounded bg-foreground text-background font-mono text-[10px] uppercase tracking-widest gap-2"
      >
        {applying && <Loader2 className="w-3 h-3 animate-spin" />}
        {applied ? (
          <>
            <Check className="w-3 h-3" /> Plan Applied
          </>
        ) : (
          'Apply Plan to Task'
        )}
      </Button>
    </div>
  );
}
