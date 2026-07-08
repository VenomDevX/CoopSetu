'use client';

import { useState } from 'react';
import { AiLogo } from '@/components/ai/ai-logo';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/permissions/context';
import { AiPanel } from '@/components/ai/ai-panel';

interface Props {
  /** AI intent to run. Defaults to free-form 'ask'. */
  intent?: string;
  title?: string;
  projectId?: string;
  sprintId?: string;
  taskId?: string;
  incidentId?: string;
  releaseId?: string;
  /** Feature permission to gate the UI on (in addition to ai:use). */
  permission?: string;
  /** Any-of these permissions gates the UI (in addition to ai:use). */
  permissions?: string[];
  label?: string;
  className?: string;
}

const DEFAULT_CLASS =
  'h-9 rounded-none text-xs font-mono uppercase tracking-widest border-border text-accent hover:bg-accent/10 gap-2 flex items-center';

/**
 * Trigger for the AI panel, gated on `ai:use` (+ an optional feature permission),
 * mirroring the server gate. When the role lacks access the button stays disabled
 * rather than failing on click.
 */
export function AskAiButton({
  intent = 'ask',
  title,
  projectId,
  sprintId,
  taskId,
  incidentId,
  releaseId,
  permission,
  permissions,
  label,
  className,
}: Props) {
  const { has, isDemo } = usePermission();
  const featureOk =
    (permission ? has(permission) : true) &&
    (permissions && permissions.length ? permissions.some((p) => has(p)) : true);
  const allowed = has('ai:use') && featureOk;
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (isDemo) {
      window.dispatchEvent(new CustomEvent('demo-alert'));
      return;
    }
    if (allowed) {
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={!allowed && !isDemo}
        title={!allowed && !isDemo ? 'Requires AI access' : undefined}
        className={`${className ?? DEFAULT_CLASS} ${label ? 'px-4' : 'w-9 justify-center p-0'} ${(!allowed && !isDemo) ? 'opacity-40' : ''}`}
      >
        <AiLogo className="w-4 h-4" />
        {label}
      </Button>
      {open && (
        <AiPanel
          intent={intent}
          title={title ?? label}
          askable={intent === 'ask'}
          projectId={projectId}
          sprintId={sprintId}
          taskId={taskId}
          incidentId={incidentId}
          releaseId={releaseId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
