'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Github, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

interface LegalConsentClientProps {
  termsVersion: string | null;
  privacyVersion: string | null;
  connectedProvider: 'GITHUB' | 'GOOGLE' | null;
  connectedLabel: string;
}

export default function LegalConsentClient({
  termsVersion,
  privacyVersion,
  connectedProvider,
  connectedLabel,
}: LegalConsentClientProps) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!agreed || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedTerms: true,
          acceptedPrivacy: true,
          source: connectedProvider ? 'OAUTH_CONSENT' : 'SIGNUP',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to record acceptance.');
      }
      router.push('/onboarding');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <OnboardingShell
      currentStep={1}
      totalSteps={4}
      stepLabel="Step 1 · Legal Consent"
      title="Before using Handoff"
      subtitle="Please review and accept the Terms of Service and Privacy Policy to continue."
      steps={[
        { id: 1, label: 'Legal Consent' },
        { id: 2, label: 'Professional Identity' },
        { id: 3, label: 'Organization Setup' },
        { id: 4, label: 'Workspace Setup' },
      ]}
    >
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        {error && (
          <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">
            {error}
          </div>
        )}

        {connectedProvider && (
          <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-sm w-fit">
            {connectedProvider === 'GITHUB' ? <Github className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground leading-none mb-1">
                {connectedProvider === 'GITHUB' ? 'GITHUB CONNECTED' : 'GOOGLE CONNECTED'}
              </span>
              <span className="text-sm font-medium leading-none">{connectedLabel}</span>
            </div>
          </div>
        )}

        <div className="bg-surface p-4 border border-border rounded text-xs text-muted-foreground font-mono space-y-1">
          <div>Terms of Service version: {termsVersion ?? 'N/A'}</div>
          <div>Privacy Policy version: {privacyVersion ?? 'N/A'}</div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-foreground"
          />
          <span className="text-sm text-foreground">
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="underline hover:opacity-80">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="underline hover:opacity-80">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!agreed || loading}
          className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full text-center text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign Out / Return to Login'}
        </button>
      </div>
    </OnboardingShell>
  );
}
