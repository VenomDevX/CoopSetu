'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ShieldCheck, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dialogLabelCls as labelCls, dialogFieldCls as fieldCls } from '@/components/ui/dialog';

interface Factor {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
}

/**
 * TOTP-based MFA enrollment, using Supabase Auth's built-in `auth.mfa` API
 * directly (no custom backend needed — Supabase stores factors server-side).
 */
export default function SecuritySettingsPage() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true);
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (!err) setFactors(data?.totp ?? []);
    setLoadingFactors(false);
  }, [supabase]);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  async function startEnroll() {
    setError(null);
    setMsg(null);
    setEnrolling(true);
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (err) {
      setError(err.message);
      setEnrolling(false);
      return;
    }
    setFactorId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  function cancelEnroll() {
    setEnrolling(false);
    setQrSvg(null);
    setSecret(null);
    setFactorId(null);
    setCode('');
    setError(null);
  }

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr) {
      setError(challengeErr.message);
      setVerifying(false);
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code,
    });
    setVerifying(false);
    if (verifyErr) {
      setError(verifyErr.message);
      return;
    }
    setMsg('Two-factor authentication enabled.');
    cancelEnroll();
    loadFactors();
  }

  async function unenroll(id: string) {
    setError(null);
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (err) {
      setError(err.message);
      return;
    }
    setMsg('Factor removed.');
    loadFactors();
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <span>Settings</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">Security</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
          <ShieldCheck className="w-8 h-8" />
          Security
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
          Manage two-factor authentication for your account.
        </p>
      </div>

      <div className="border border-border bg-background">
        <div className="p-4 border-b border-border bg-surface-hover">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold">Authenticator App (TOTP)</h2>
        </div>

        <div className="p-6 space-y-5">
          {msg && (
            <div className="border border-emerald-500/50 bg-emerald-500/10 text-emerald-500 text-xs px-3 py-2 font-mono">{msg}</div>
          )}
          {error && (
            <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>
          )}

          {loadingFactors ? (
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Loading…</div>
          ) : factors.length > 0 ? (
            <div className="space-y-2">
              {factors.map((f) => (
                <div key={f.id} className="flex items-center justify-between border border-border p-3">
                  <div>
                    <div className="text-sm font-bold">{f.friendly_name || 'Authenticator App'}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {f.status}
                    </div>
                  </div>
                  <button
                    onClick={() => unenroll(f.id)}
                    className="h-8 px-3 border border-border text-xs font-mono uppercase tracking-widest flex items-center gap-2 hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ))}
            </div>
          ) : !enrolling ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No authenticator app is enrolled. Add one for an extra layer of security on sign-in.
              </p>
              <button
                onClick={startEnroll}
                className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest"
              >
                Enable Two-Factor Authentication
              </button>
            </div>
          ) : null}

          {enrolling && qrSvg && (
            <div className="border border-border p-4 space-y-4">
              <div>
                <label className={labelCls}>Scan with your authenticator app</label>
                {/* Rendered as an <img> data URI rather than dangerouslySetInnerHTML
                    so the server-supplied SVG markup is never injected into the DOM. */}
                <img
                  className="w-40 h-40 bg-white p-2"
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
                  alt="Authenticator app QR code"
                />
              </div>
              {secret && (
                <div>
                  <label className={labelCls}>Or enter this code manually</label>
                  <code className="block text-xs font-mono break-all bg-surface border border-border p-2">{secret}</code>
                </div>
              )}
              <div>
                <label className={labelCls}>6-digit code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${fieldCls} font-mono tracking-widest`}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={cancelEnroll} className="h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest">
                  Cancel
                </button>
                <button
                  onClick={verify}
                  disabled={verifying || code.length !== 6}
                  className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                >
                  {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Verify &amp; Enable
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
