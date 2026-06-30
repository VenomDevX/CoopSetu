'use client';

import { AlertTriangle, RefreshCcw, LogOut, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/permissions/context';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DemoBanner() {
  const { isDemo } = usePermission();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  if (!isDemo) return null;

  const handleReset = async () => {
    setLoading('reset');
    try {
      await fetch('/api/v1/demo/reset', { method: 'POST' });
      router.refresh();
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const handleExit = async () => {
    setLoading('exit');
    try {
      await fetch('/api/v1/demo/exit', { method: 'POST' });
      window.location.href = '/login';
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const handleCreate = () => {
    window.location.href = '/signup';
  };

  return (
    <div className="w-full bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono shrink-0 z-50">
      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 font-bold uppercase tracking-widest text-center sm:text-left">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>DEMO WORKSPACE — Sample data only. Changes are isolated and reset automatically.</span>
      </div>
      
      <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-[10px] rounded-none uppercase tracking-widest whitespace-nowrap"
          onClick={handleReset}
          disabled={!!loading}
        >
          <RefreshCcw className="w-3 h-3 mr-2" />
          {loading === 'reset' ? 'Resetting...' : 'Reset Demo'}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-[10px] rounded-none uppercase tracking-widest whitespace-nowrap"
          onClick={handleExit}
          disabled={!!loading}
        >
          <LogOut className="w-3 h-3 mr-2" />
          {loading === 'exit' ? 'Exiting...' : 'Exit Demo'}
        </Button>
        <Button 
          variant="default" 
          size="sm" 
          className="h-7 text-[10px] rounded-none uppercase tracking-widest whitespace-nowrap bg-foreground text-background hover:bg-foreground/90"
          onClick={handleCreate}
          disabled={!!loading}
        >
          Create Your Workspace
          <ArrowRight className="w-3 h-3 ml-2" />
        </Button>
      </div>
    </div>
  );
}
