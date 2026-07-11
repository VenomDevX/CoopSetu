'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingShell } from '@/components/auth/onboarding-shell';
import { checkPassword } from '@/lib/validation/password';

export default function ResetPasswordClient() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  const { length: passLength, upper: passUpper, lower: passLower, number: passNumber, special: passSpecial, strength: passStrength } = checkPassword(password);
  const passMatch = password.length > 0 && password === confirmPassword;
  const isValid = passLength && passUpper && passLower && passNumber && passSpecial && passMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;

    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError('Could not update your password. The link may have expired — request a new one.');
      return;
    }

    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => router.push('/login'), 2500);
  }

  if (done) {
    return (
      <OnboardingShell currentStep={1} totalSteps={1} stepLabel="Account Recovery" title="Password updated">
        <div className="bg-surface p-6 border border-border rounded text-center space-y-4 rounded-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <p className="text-sm text-muted-foreground">Your password has been changed. Redirecting you to sign in…</p>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      currentStep={1}
      totalSteps={1}
      stepLabel="Account Recovery"
      title="Choose a new password"
      subtitle="Enter a strong new password for your account."
    >
      <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        {error && (
          <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">
            {error}
          </div>
        )}

        <div className="space-y-4 w-full">
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="space-y-1.5 relative w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">New Password</label>
              <input
                className={`w-full h-11 px-4 pr-10 bg-surface border text-sm focus:outline-none transition-colors ${touched && !passLength ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setTouched(true)}
                autoComplete="new-password"
                required
                autoFocus
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 bottom-0 h-11 flex items-center text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="space-y-1.5 relative w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Confirm Password</label>
              <input
                className={`w-full h-11 px-4 pr-10 bg-surface border text-sm focus:outline-none transition-colors ${touched && confirmPassword.length > 0 && !passMatch ? 'border-red-500 focus:border-red-500' : passMatch ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {passMatch && <span className="absolute right-3 bottom-0 h-11 flex items-center pointer-events-none"><CheckCircle2 className="w-4 h-4 text-green-500" /></span>}
            </div>
          </div>

          <div className="bg-surface p-4 border border-border rounded space-y-3 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Password Guidance</span>
              <span className={`text-[10px] font-mono uppercase tracking-widest ${passStrength === 'STRONG' ? 'text-green-500' : passStrength === 'FAIR' ? 'text-yellow-500' : 'text-red-500'}`}>{passStrength}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className={`flex items-center gap-2 transition-colors duration-150 ${passLength ? 'text-green-500' : 'text-muted-foreground'}`}><CheckCircle2 className="w-3.5 h-3.5" /> 12+ characters</div>
              <div className={`flex items-center gap-2 transition-colors duration-150 ${passMatch ? 'text-green-500' : 'text-muted-foreground'}`}><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</div>
              <div className={`flex items-center gap-2 transition-colors duration-150 ${passUpper ? 'text-green-500' : 'text-muted-foreground'}`}><CheckCircle2 className="w-3.5 h-3.5" /> Uppercase (A-Z)</div>
              <div className={`flex items-center gap-2 transition-colors duration-150 ${passLower ? 'text-green-500' : 'text-muted-foreground'}`}><CheckCircle2 className="w-3.5 h-3.5" /> Lowercase (a-z)</div>
              <div className={`flex items-center gap-2 transition-colors duration-150 ${passNumber ? 'text-green-500' : 'text-muted-foreground'}`}><CheckCircle2 className="w-3.5 h-3.5" /> Number (0-9)</div>
              <div className={`flex items-center gap-2 transition-colors duration-150 ${passSpecial ? 'text-green-500' : 'text-muted-foreground'}`}><CheckCircle2 className="w-3.5 h-3.5" /> Special character</div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={!isValid || loading} className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
        </button>

        <div className="text-center">
          <Link href="/login" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </div>
      </form>
    </OnboardingShell>
  );
}
