'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

const emailSchema = z.string().email();

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isEmailValid = emailSchema.safeParse(email).success;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isEmailValid) return;

    setLoading(true);
    const supabase = createClient();
    // Always show the same success state regardless of outcome — never reveal
    // whether an account exists for this email (enumeration-safe, matching the
    // pattern already used in app/api/v1/auth/login/route.ts).
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <OnboardingShell
        currentStep={1}
        totalSteps={1}
        stepLabel="Account Recovery"
        title="Check your email"
        subtitle={`If an account exists for ${email}, we've sent a password reset link.`}
      >
        <div className="bg-surface p-6 border border-border rounded text-center space-y-4 rounded-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <MailCheck className="w-12 h-12 text-green-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Click the link in the email to choose a new password. The link expires shortly, so use it soon.
          </p>
          <div className="pt-4">
            <Link
              href="/login"
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      currentStep={1}
      totalSteps={1}
      stepLabel="Account Recovery"
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link."
      steps={[{ id: 1, label: 'Reset Password' }]}
    >
      <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        <div className="space-y-1.5 w-full">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email</label>
          <input
            className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors ${touched && !isEmailValid ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setTouched(true); }}
            required
            autoFocus
          />
          {touched && !isEmailValid && <p className="text-[10px] text-red-500 font-mono">Enter a valid email address</p>}
        </div>

        <button
          type="submit"
          disabled={!isEmailValid || loading}
          className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
        </button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </div>
      </form>
    </OnboardingShell>
  );
}
