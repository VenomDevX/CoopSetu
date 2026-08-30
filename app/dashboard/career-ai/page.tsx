'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Send, Sparkles, User, Briefcase, BookOpen, Target } from 'lucide-react';
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

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
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const userMessage: Message = { role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulated AI response based on keyword matching
    setTimeout(() => {
      let response = '';
      const lower = msg.toLowerCase();

      if (lower.includes('job') || lower.includes('suitable') || lower.includes('employment')) {
        response = "Based on your current skill profile, here are my top recommendations:\n\n🏢 **Cooperative Field Officer** — 91% match\n📊 **Data Entry Executive** — 87% match\n🏦 **Rural Finance Assistant** — 82% match\n📋 **Cooperative Audit Clerk** — 78% match\n\nThese roles align well with your Digital Literacy, Cooperative Management, and Accounting skills. Would you like me to analyze the skill gaps for any of these roles?";
      } else if (lower.includes('skill') && (lower.includes('learn') || lower.includes('next') || lower.includes('improve'))) {
        response = "Based on your current profile, I recommend focusing on:\n\n1. **MS Excel** (Currently missing) — Required for 73% of matching jobs\n2. **Communication Skills** (Partially developed) — Boost to 80%+ proficiency\n3. **Financial Management** — Valuable for cooperative sector roles\n\n📚 **Recommended courses:**\n• Excel Fundamentals for Cooperatives\n• Workplace Communication Essentials\n• Cooperative Financial Management\n\nShall I help you enroll in any of these?";
      } else if (lower.includes('gap') || lower.includes('analysis')) {
        response = "**Skill Gap Analysis — Cooperative Field Officer**\n\n✅ **Matched Skills:**\n• Cooperative Management — 85%\n• Digital Literacy — 80%\n• Accounting — 75%\n\n⚠️ **Partial Match:**\n• Communication — 55% (needs 70%+)\n\n❌ **Missing Skills:**\n• MS Excel\n• Report Writing\n\n📈 **Estimated Readiness:** 72%\n\n**Action Plan:**\n→ Complete Excel Fundamentals course\n→ Take Workplace Communication workshop\n→ Estimated readiness after completion: 91%";
      } else if (lower.includes('course') || lower.includes('programme') || lower.includes('training')) {
        response = "Here are the recommended training programmes:\n\n📚 **Active Programmes:**\n1. Digital Cooperative Management (90 days) — Starts Sep 15\n2. Rural Finance & Banking (60 days) — Starts Oct 1\n3. Cooperative Audit & Compliance (45 days) — Starts Nov 1\n\n🎯 **Based on your skill gaps:**\n• Excel Fundamentals — 2 weeks intensive\n• Communication Skills Workshop — 1 week\n\nWould you like to register for any of these?";
      } else if (lower.includes('readiness') || lower.includes('score') || lower.includes('employability')) {
        response = "**Your Employment Readiness Score: 72%**\n\n📊 **Score Breakdown:**\n• Skill Proficiency: 65/100\n• Certifications: 15/20 (3 certificates)\n• Course Completion: 12/15 (4 courses)\n• Assessment Scores: 80/100\n\n🎯 **To reach 90%+:**\n1. Complete 2 more certifications (+5%)\n2. Improve MS Excel skill (+8%)\n3. Complete Communication course (+5%)\n\nEstimated time to 90%: ~6 weeks with active learning.";
      } else {
        response = "I understand you're looking for career guidance. Here's what I can help with:\n\n• **Job Matching** — Find jobs that match your skills\n• **Skill Gap Analysis** — Compare your skills with job requirements\n• **Course Recommendations** — Find the right training\n• **Career Planning** — Build a path to employment\n\nCould you be more specific about what you'd like to know?";
      }

      const assistantMessage: Message = { role: 'assistant', content: response, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
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
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
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
        {isTyping && (
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
        <Button onClick={() => sendMessage()} className="rounded px-4" disabled={isTyping}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
