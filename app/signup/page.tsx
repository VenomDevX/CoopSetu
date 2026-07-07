'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ChevronRight, Loader2, Eye, EyeOff, Github, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

// Any alphabet/script (Unicode letters + marks) — names aren't Latin-only.
const nameSchema = z.string().min(1).max(100).regex(/^[\p{L}\p{M}\s'.\-]+$/u);
const emailSchema = z.string().email();

export default function SignupPage() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Step 1: Account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched1, setTouched1] = useState(false);

  // Validation
  const isNameValid = nameSchema.safeParse(fullName).success;
  const isEmailValid = emailSchema.safeParse(email).success;
  const passLength = password.length >= 12;
  const passUpper = /[A-Z]/.test(password);
  const passLower = /[a-z]/.test(password);
  const passNumber = /[0-9]/.test(password);
  const passSpecial = /[^A-Za-z0-9]/.test(password);
  const passMatch = password.length > 0 && password === confirmPassword;

  const passScore = [passUpper, passLower, passNumber, passSpecial].filter(Boolean).length;
  const passStrength = passScore < 2 ? 'WEAK' : passScore < 4 ? 'FAIR' : 'STRONG';

  const isStep1Valid = isNameValid && isEmailValid && passLength && passUpper && passLower && passNumber && passSpecial && passMatch;

  async function signInWithGithub() {
    setError(null);
    setGithubLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError('Could not start GitHub sign-in. Please try again.');
      setGithubLoading(false);
    }
  }

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setTouched1(true);
    if (!isStep1Valid) return;

    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (signupError) {
      if (signupError.message.includes('already registered')) {
        setError('An account with this email already exists.');
      } else {
        setError(signupError.message);
      }
      setLoading(false);
      return;
    }

    // Check if a session was created. If email confirmation is enabled, session will be null.
    if (!data.session) {
      setEmailSent(true);
      setLoading(false);
      return;
    }

    // Session created (email confirmation disabled or auto-confirmed)
    router.push('/onboarding');
    router.refresh();
  };

  if (emailSent) {
    return (
      <OnboardingShell
        currentStep={1}
        totalSteps={4}
        stepLabel="Account Verification"
        title="Check your email"
        subtitle={`We sent a verification link to ${email}`}
      >
        <div className="bg-surface p-6 border border-border text-center space-y-4 rounded-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Please click the link in the email to verify your account and continue setting up your workspace.
          </p>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setEmailSent(false)}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to Sign Up
            </button>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      currentStep={1}
      totalSteps={4}
      stepLabel="Account Details"
      title="Create your account"
      subtitle="Enter your personal details to get started."
    >
      <form onSubmit={handleSignup} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        {error && (
          <div className="mb-6 p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">
            {error}
          </div>
        )}

        <div className="space-y-6 w-full">
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="space-y-1.5 w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Full Name</label>
              <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && !isNameValid ? 'border-red-500 focus:border-red-500' : isNameValid && touched1 ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                type="text" placeholder="Jane Doe" value={fullName} onChange={(e) => { setFullName(e.target.value); setTouched1(true); }} required autoFocus />
              {touched1 && !isNameValid && <p className="text-[10px] text-red-500 font-mono">Letters, spaces, hyphens only (min 2)</p>}
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Work Email</label>
              <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && !isEmailValid ? 'border-red-500 focus:border-red-500' : isEmailValid && touched1 ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                type="email" placeholder="jane@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setTouched1(true); }} required />
            </div>
          </div>

          <div className="space-y-4 w-full">
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="space-y-1.5 relative w-full">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Password</label>
                <input className={`w-full h-11 px-4 pr-10 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && !passLength ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
                  type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setTouched1(true)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 bottom-0 h-11 flex items-center text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="space-y-1.5 relative w-full">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Confirm Password</label>
                <input className={`w-full h-11 px-4 pr-10 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && password.length > 0 && !passMatch ? 'border-red-500 focus:border-red-500' : passMatch ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                  type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                {passMatch && <span className="absolute right-3 bottom-0 h-11 flex items-center pointer-events-none"><CheckCircle2 className="w-4 h-4 text-green-500" /></span>}
              </div>
            </div>

            {/* Live Password Checklist */}
            <div className="bg-surface p-4 border border-border space-y-3 w-full">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Password Guidance</span>
                <span className={`text-[10px] font-mono uppercase tracking-widest ${passStrength === 'STRONG' ? 'text-green-500' : passStrength === 'FAIR' ? 'text-yellow-500' : 'text-red-500'}`}>{passStrength}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className={`flex items-center gap-2 transition-colors duration-150 ${passLength ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> 12+ characters
                </div>
                <div className={`flex items-center gap-2 transition-colors duration-150 ${passMatch ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                </div>
                <div className={`flex items-center gap-2 transition-colors duration-150 ${passUpper ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Uppercase (A-Z)
                </div>
                <div className={`flex items-center gap-2 transition-colors duration-150 ${passLower ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lowercase (a-z)
                </div>
                <div className={`flex items-center gap-2 transition-colors duration-150 ${passNumber ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Number (0-9)
                </div>
                <div className={`flex items-center gap-2 transition-colors duration-150 ${passSpecial ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Special character
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={!isStep1Valid || loading} className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ChevronRight className="w-4 h-4" /></>}
        </button>

        <div className="flex items-center gap-3 py-2 w-full">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Or continue with</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={signInWithGithub}
          disabled={githubLoading || loading}
          className="w-full h-11 bg-surface border border-border text-xs font-mono uppercase tracking-widest hover:bg-surface-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {githubLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
          Continue with GitHub
        </button>
      </form>
    </OnboardingShell>
  );
}
