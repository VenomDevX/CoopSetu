'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-widest mb-2">Contact Us</h1>
        <p className="text-muted-foreground text-sm">We typically respond within one business day.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Support', value: 'support@handoff.dev', sub: 'Technical issues & bugs' },
          { label: 'Sales', value: 'sales@handoff.dev', sub: 'Enterprise plans & pricing' },
          { label: 'Security', value: 'security@handoff.dev', sub: 'Vulnerability disclosures' },
        ].map((c) => (
          <div key={c.label} className="border border-border p-4 space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</div>
            <a href={`mailto:${c.value}`} className="font-mono text-xs hover:underline block">{c.value}</a>
            <div className="text-[11px] text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>

      {submitted ? (
        <div className="border border-border p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-10 h-10 text-foreground" />
          <div>
            <div className="font-mono text-sm font-bold uppercase tracking-widest">Message Sent</div>
            <p className="text-xs text-muted-foreground mt-1">We'll be in touch shortly.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Send a Message</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="font-mono text-[10px] uppercase tracking-widest">Name</Label>
              <Input id="name" name="name" required placeholder="Your name" className="rounded-none font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@company.com" className="rounded-none font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject" className="font-mono text-[10px] uppercase tracking-widest">Subject</Label>
            <Input id="subject" name="subject" required placeholder="How can we help?" className="rounded-none font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message" className="font-mono text-[10px] uppercase tracking-widest">Message</Label>
            <Textarea id="message" name="message" required rows={5} placeholder="Describe your question or issue..." className="rounded-none font-mono text-xs resize-none" />
          </div>
          <Button type="submit" disabled={loading} className="rounded-none font-mono text-xs uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 px-8">
            {loading ? 'Sending...' : 'Send Message'}
          </Button>
        </form>
      )}
    </div>
  );
}
