'use client';

import Link from 'next/link';
import { User, Users, KeyRound, ArrowRight } from 'lucide-react';

export function StudentWorkspaceChoices() {
  return (
    <div className="space-y-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link
        href="/onboarding/student/solo"
        className="w-full text-left p-6 border border-border rounded bg-surface hover:border-foreground/40 hover:bg-surface-hover transition-colors group flex items-start justify-between gap-4"
      >
        <div className="flex gap-4">
          <User className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Personal Solo Workspace</div>
            <div className="font-semibold mb-1">Recommended for individual coursework and personal projects.</div>
            <p className="text-sm text-muted-foreground">A private place for your ideas, projects, tasks, and delivery planning.</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </Link>

      <Link
        href="/onboarding/student/team"
        className="w-full text-left p-6 border border-border rounded bg-surface hover:border-foreground/40 hover:bg-surface-hover transition-colors group flex items-start justify-between gap-4"
      >
        <div className="flex gap-4">
          <Users className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Create a Student Team</div>
            <div className="font-semibold mb-1">For hackathons, group assignments, clubs, and collaborative projects.</div>
            <p className="text-sm text-muted-foreground">Get a secure join code to invite teammates.</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </Link>

      <Link
        href="/join-team"
        className="w-full text-left p-6 border border-border rounded bg-surface hover:border-foreground/40 hover:bg-surface-hover transition-colors group flex items-start justify-between gap-4"
      >
        <div className="flex gap-4">
          <KeyRound className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Join a Student Team</div>
            <div className="font-semibold mb-1">Enter a secure join code from a team leader.</div>
            <p className="text-sm text-muted-foreground">Your leader can find their code in Team Settings.</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </Link>
    </div>
  );
}
