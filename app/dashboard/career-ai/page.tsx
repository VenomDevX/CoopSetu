'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAiStream } from "@/components/ai/use-ai-stream";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "What jobs are suitable for me based on my skills?",
  "Which skills should I learn next?",
  "What course should I take to improve my employability?",
  "How can I improve my employment readiness score?",
  "What is the skill gap for a Cooperative Field Officer role?",
  "Recommend training programmes for rural development.",
];

export default function CareerAIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI Career Assistant powered by CoopSetu. I can help you with:\n\n• Finding suitable jobs based on your skills\n• Identifying skill gaps for specific roles\n• Recommending courses and training programmes\n• Career guidance for the cooperative sector\n\nHow can I help you today?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { answer, loading, error, done, run, reset } = useAiStream();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, answer]);

  // Commit the finished (or failed) stream into the message list, then reset
  // the hook so the next send starts from a clean state. useAiStream is an
  // external system (an SSE connection) — this reacts to it finishing, which
  // is exactly the "subscribe to an external system" case React's own set-state-in-effect
  // guidance carves out, not state-mirroring.
  useEffect(() => {
    if (done) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the ai-stream hook (an external SSE connection) completing, not mirroring render state
      setMessages(prev => [...prev, { role: 'assistant', content: answer || 'No response received.', timestamp: new Date() }]);
      reset();
    } else if (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: error, timestamp: new Date() }]);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, error]);

  const sendMessage = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date() }]);
    setInput('');
    // Send the transcript so the counsellor can follow a thread. Built from
    // `messages` before this turn is appended — the new message travels as
    // `prompt`, and including it in history too would duplicate it.
    run({
      intent: 'my-learning',
      prompt: msg,
      history: messages
        .filter(m => m.content?.trim())
        .slice(-12)
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, text: m.content })),
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 h-[calc(100dvh-10rem)] flex flex-col">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border-b border-border pb-6 shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-accent animate-pulse rounded" />
          Cooperative_AI // Career Assistant
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Career AI</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono">Personalized career guidance powered by your skill profile</p>
      </motion.div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} data-testid={`chat-message-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user' ? 'bg-foreground text-background' : 'bg-surface-hover border border-border'
              }`}>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                <div className="text-[9px] font-mono uppercase tracking-widest mt-2 opacity-50">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-background" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && !answer && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-accent animate-pulse" />
            </div>
            <div className="bg-surface-hover border border-border rounded-lg px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {loading && answer && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-surface-hover border border-border">
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{answer}</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 1 && (
        <div className="shrink-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Suggested Questions</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button key={i} onClick={() => sendMessage(prompt)}
                className="text-left px-3 py-2 border border-border rounded text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 flex gap-3">
        <input
          className="flex-1 px-4 py-3 border border-border rounded bg-background text-sm font-mono focus:border-foreground transition-colors"
          placeholder="Ask about careers, skills, jobs, or training..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <Button onClick={() => sendMessage()} aria-label="Send message" className="rounded px-4" disabled={loading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
