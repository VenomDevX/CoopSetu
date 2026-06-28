export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-widest mb-2">About Handoff</h1>
        <p className="text-muted-foreground text-sm font-mono">Version 1.0 · Enterprise Edition</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">What We Build</h2>
        <p className="text-sm leading-relaxed">
          Handoff is an enterprise-grade project intelligence platform designed for modern engineering teams. We unify project management, sprint planning, incident response, QA, and AI-assisted workflows into a single, coherent workspace.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Built on a real-time infrastructure, Handoff gives your team a single source of truth — from the first commit to production deployment.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Core Principles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Speed First', body: 'Every interaction is optimized for keyboard-first, low-latency workflows.' },
            { title: 'AI-Augmented', body: 'Embedded AI assists with triage, summaries, and cross-team context without replacing human judgement.' },
            { title: 'Enterprise Security', body: 'Role-based access control, audit logs, and org-level isolation out of the box.' },
            { title: 'Open Integration', body: 'Connects to your existing Git repositories, CI pipelines, and communication tools.' },
          ].map((p) => (
            <div key={p.title} className="border border-border p-4 space-y-1">
              <div className="font-mono text-xs font-bold uppercase tracking-widest">{p.title}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Technology Stack</h2>
        <div className="flex flex-wrap gap-2">
          {['Next.js 15', 'React 19', 'Supabase', 'PostgreSQL', 'TypeScript', 'Tailwind CSS', 'Claude AI'].map((t) => (
            <span key={t} className="font-mono text-[10px] uppercase tracking-widest border border-border px-3 py-1 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Release Info</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-xs font-mono max-w-sm">
          <dt className="text-muted-foreground uppercase tracking-widest">Version</dt><dd>1.0.0</dd>
          <dt className="text-muted-foreground uppercase tracking-widest">Released</dt><dd>2026-06-28</dd>
          <dt className="text-muted-foreground uppercase tracking-widest">License</dt><dd>Enterprise</dd>
          <dt className="text-muted-foreground uppercase tracking-widest">Support</dt><dd>support@handoff.dev</dd>
        </dl>
      </section>
    </div>
  );
}
