import Link from 'next/link';
import { ShieldCheck, ShieldX, Calendar, Building2, User, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CertificateService } from '@/services/certificate.service';

export const dynamic = 'force-dynamic';

/**
 * Public certificate verification result.
 *
 * Server-rendered so the answer is in the HTML: a verifier may be on a slow
 * connection, and this page is the whole point of the QR printed on a
 * certificate. It calls the same service the API route uses rather than
 * fetching its own endpoint over HTTP.
 *
 * Deliberately shows only what verify_certificate() returns. That RPC curates
 * its column list — holder email, trainee_id and programme_id are excluded — so
 * a certificate number cannot be used to enumerate personal data.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const decoded = decodeURIComponent(certificateNumber);

  const supabase = await createClient();
  const svc = new CertificateService(supabase);

  let result: Awaited<ReturnType<CertificateService['verify']>> | null = null;
  let failed = false;
  try {
    result = await svc.verify(decoded);
  } catch {
    // A lookup failure is not a verdict. Saying "invalid" when the service was
    // simply unreachable would be worse than admitting we could not check.
    failed = true;
  }

  const cert = result?.certificate;
  const valid = result?.valid === true;

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6">
          <ShieldCheck className="w-4 h-4 text-accent" />
          NCCT // Certificate verification
        </div>

        <div
          className={`border rounded p-6 mb-6 ${
            failed
              ? 'border-border bg-surface'
              : valid
                ? 'border-green-500/40 bg-green-500/10'
                : 'border-red-500/40 bg-red-500/10'
          }`}
        >
          <div className="flex items-start gap-4">
            {failed ? (
              <Search className="w-8 h-8 text-muted-foreground shrink-0" />
            ) : valid ? (
              <ShieldCheck className="w-8 h-8 text-green-500 shrink-0" />
            ) : (
              <ShieldX className="w-8 h-8 text-red-500 shrink-0" />
            )}
            <div className="min-w-0">
              <h1
                className={`text-2xl font-bold tracking-tighter uppercase ${
                  failed ? 'text-foreground' : valid ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {failed ? 'Could not check' : valid ? 'Valid certificate' : 'Not valid'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {failed
                  ? 'Verification is temporarily unavailable. Please try again shortly.'
                  : result?.message}
              </p>
            </div>
          </div>
        </div>

        {cert && (
          <dl className="border border-border rounded divide-y divide-border">
            <Row icon={<User className="w-4 h-4" />} label="Issued to" value={cert.holder_name} />
            <Row icon={<ShieldCheck className="w-4 h-4" />} label="Certificate" value={cert.title} />
            {cert.programmes?.title && (
              <Row icon={<Building2 className="w-4 h-4" />} label="Programme" value={cert.programmes.title} />
            )}
            <Row icon={<Building2 className="w-4 h-4" />} label="Issued by" value={cert.issuer_name} />
            <Row
              icon={<Calendar className="w-4 h-4" />}
              label="Issued on"
              value={cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—'}
            />
            {cert.valid_until && (
              <Row
                icon={<Calendar className="w-4 h-4" />}
                label="Valid until"
                value={new Date(cert.valid_until).toLocaleDateString('en-IN', { dateStyle: 'long' })}
              />
            )}
            <Row icon={<ShieldCheck className="w-4 h-4" />} label="Number" value={cert.certificate_number} mono />
          </dl>
        )}

        {!cert && !failed && (
          <div className="border border-dashed border-border rounded p-6 text-center">
            <p className="font-mono text-xs text-muted-foreground">
              No certificate matches <span className="text-foreground">{decoded}</span>.
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Link href="/verify" className="hover:text-foreground transition-colors">← Check another</Link>
          <Link href="/" className="hover:text-foreground transition-colors">CoopSetu</Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon, label, value, mono,
}: { icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-28 shrink-0 mt-1">
        {label}
      </dt>
      <dd className={`text-sm text-foreground min-w-0 break-words ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}
