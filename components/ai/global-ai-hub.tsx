'use client';

import { useState, useEffect } from 'react';
import { Bot, X, MessageSquare, Sun, LayoutDashboard, ChevronRight, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/permissions/context';
import { AI_INSIGHTS, type AiInsightIntent } from '@/lib/constants/ai-insights';
import { AiPanel } from '@/components/ai/ai-panel';
import { HubChatTab, HubBriefTab } from '@/components/ai/hub-tabs';
import { createPortal } from 'react-dom';

type Tab = 'chat' | 'brief' | 'insights';

export function GlobalAiHub() {
  const { has, isDemo } = usePermission();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [insightIntent, setInsightIntent] = useState<AiInsightIntent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const hasAi = has('ai:use');

  const panel = mounted ? createPortal(
    <>
      <AnimatePresence>
      {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] pointer-events-auto"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 w-full md:w-[480px] h-full bg-background border-l border-border z-[61] flex flex-col shadow-2xl pointer-events-auto"
            >
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-5 border-b border-border bg-surface-hover flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-accent" />
                  <h2 className="font-mono text-xs uppercase tracking-widest font-bold">Handoff AI</h2>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 hover:bg-surface border border-transparent hover:border-border transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs Nav */}
              <div className="flex border-b border-border flex-shrink-0">
                <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={MessageSquare} label="Ask AI" />
                <TabButton active={activeTab === 'brief'} onClick={() => setActiveTab('brief')} icon={Sun} label="Daily Brief" />
                <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={LayoutDashboard} label="Insights" />
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col relative bg-background">
                {activeTab === 'chat' && <HubChatTab onClose={() => setOpen(false)} />}
                
                {activeTab === 'brief' && <HubBriefTab onClose={() => setOpen(false)} />}
                
                {activeTab === 'insights' && (
                  <div className="absolute inset-0 overflow-y-auto p-5 space-y-2">
                    {AI_INSIGHTS.map((meta) => {
                      const allowed = hasAi && meta.permissions.some((p) => has(p));
                      return (
                        <button
                          key={meta.intent}
                          disabled={!allowed}
                          onClick={() => setInsightIntent(meta.intent)}
                          className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono uppercase tracking-widest font-bold flex items-center gap-2 mb-1">
                              {meta.label}
                              {!allowed && <Lock className="w-3 h-3 text-muted-foreground" />}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {allowed ? meta.description : 'Unavailable for your role'}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Layer the contextual AiPanel over the hub if an insight is clicked */}
      {insightIntent && (
        <AiPanel
          intent={insightIntent}
          title={AI_INSIGHTS.find((i) => i.intent === insightIntent)?.label}
          onClose={() => setInsightIntent(null)}
        />
      )}
    </>,
    document.body
  ) : null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (isDemo) {
            window.dispatchEvent(new CustomEvent('demo-alert'));
            return;
          }
          setOpen(true);
        }}
        className="h-9 px-3 sm:px-4 gap-2 border-border text-xs font-mono uppercase tracking-widest text-foreground rounded-none hover:bg-surface-hover hover:text-foreground"
      >
        <Bot className="w-4 h-4 text-accent" />
        <span className="hidden sm:inline">AI Hub</span>
      </Button>

      {panel}
    </>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 border-b-2 transition-colors ${
        active ? 'border-foreground text-foreground bg-surface-hover' : 'border-transparent text-muted-foreground hover:bg-surface-hover/50 hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="font-mono text-[9px] uppercase tracking-widest font-bold">{label}</span>
    </button>
  );
}
