import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Search } from 'lucide-react';

export const metadata = {
  title: 'Verify a certificate — CoopSetu',
  description: 'Check an NCCT training certificate without an account.',
};

/**
 * Public certificate lookup.
 *
 * The verification RPC has existed since 0077, is SECURITY DEFINER, granted to
 * anon and allow-listed in lib/supabase/middleware.ts — but nothing in the
 * product used it. The only certificate UI sat behind /dashboard, so the person
 * this feature exists for, an employer or registrar holding a certificate
 * number, had nowhere to go.
 *
 * A server component with a plain GET form: no client JS, so it works on a
 * feature phone browser and is linkable and shareable.
 */
export default async function VerifyLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ cert?: string }>;
}) {
  // The form submits here with ?cert=..., which becomes a shareable
  // /verify/<number> URL — the same shape the QR on a certificate encodes.
  const { cert } = await searchParams;
  if (cert?.trim()) redirect(`/verify/${encodeURIComponent(cert.trim())}`);

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-background text-foreground">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6">
          <ShieldCheck className="w-4 h-4 text-accent" />
          NCCT // Certificate verification
        </div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase mb-3">Verify a certificate</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          Enter the certificate number printed on the document. No account is needed.
        </p>

        <form action="/verify" method="GET" className="flex gap-2">
          <input
            name="cert"
            required
            placeholder="CERT-NCCT-2026-000123"
            aria-label="Certificate number"
            className="flex-1 px-4 h-12 border border-border rounded bg-surface text-sm font-mono focus:outline-none focus:border-foreground"
          />
          <button
            type="submit"
            className="h-12 px-5 rounded bg-foreground text-background font-mono text-xs uppercase tracking-widest inline-flex items-center gap-2"
          >
            <Search className="w-4 h-4" /> Check
          </button>
        </form>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">← CoopSetu</Link>
        </p>
      </div>
    </div>
  );
}
