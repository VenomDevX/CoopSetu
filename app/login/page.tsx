'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';

const DEMO_ACCOUNTS = [
  { label: 'Org Admin', email: 'admin@apexfintech.test' },
  { label: 'Project Manager', email: 'pm@apexfintech.test' },
  { label: 'Team Manager', email: 'tm@apexfintech.test' },
  { label: 'Developer', email: 'dev@apexfintech.test' },
  { label: 'QA Engineer', email: 'qa@apexfintech.test' },
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isDevelopment = process.env.NODE_ENV === 'development';

  async function signIn(e: React.FormEvent, overrideIdentifier?: string) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginId = overrideIdentifier ?? identifier;

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginId, password: overrideIdentifier ? (process.env.NEXT_PUBLIC_TEST_USER_PASSWORD ?? '') : password, rememberDevice: remember })
      });

      const json = await res.json();

      if (!res.ok) {
        setLoading(false);
        setError(json.error?.message || 'Invalid username/email or password.');
        return;
      }

      const nextParam = params.get('next');
      const safeNext = (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//'))
        ? nextParam
        : '/dashboard';

      router.push(json.data?.redirectUrl || safeNext);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError('An unexpected error occurred. Please try again.');
    }
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-background text-foreground selection:bg-foreground selection:text-background font-sans">

      {/* LEFT: Branding & Info (45%) */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] border-r border-border bg-surface relative overflow-hidden">
        {/* Subtle grid background overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

        <div className="p-12 relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <Logo width={32} height={32} />
            <span className="uppercase tracking-widest text-base font-bold">HANDOFF</span>
          </div>

          <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4 border border-border inline-block px-2 py-1 bg-background">
            SECURE_WORKSPACE_ACCESS
          </h2>
          <h1 className="text-4xl font-semibold leading-tight mb-6 tracking-tight">
            Enter your delivery workspace.
          </h1>
          <p className="text-muted-foreground text-lg mb-12 max-w-md leading-relaxed">
            Sign in to manage projects, tasks, teams, approvals, and real-time delivery work.
          </p>

          <div className="space-y-4 font-mono text-xs text-muted-foreground tracking-widest uppercase">
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-foreground"></div> ORG_SCOPED_ACCESS</div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-foreground"></div> ROLE_AWARE_WORKSPACE</div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-foreground"></div> REALTIME_DELIVERY_SYNC</div>
          </div>
        </div>

        <div className="p-12 relative z-10 flex gap-4">
          <span className="px-3 py-1 bg-background border border-border text-[10px] font-mono uppercase tracking-widest rounded-sm">SOC2 Type II</span>
          <span className="px-3 py-1 bg-background border border-border text-[10px] font-mono uppercase tracking-widest rounded-sm">End-to-End Encrypted</span>
        </div>
      </div>

      {/* RIGHT SIDE (Form 55%) */}
      <div className="w-full lg:w-[55%] flex flex-col items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[400px] space-y-8">

          <div className="lg:hidden flex items-center gap-3 mb-8">
            <Logo width={28} height={28} />
            <span className="uppercase tracking-widest text-sm font-bold">HANDOFF</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Sign In</h1>
            <p className="text-xs text-muted-foreground">Authenticate to access your organization.</p>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Username or email</label>
                <input
                  className="w-full h-10 px-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Password</label>
                  <Link href="/forgot-password" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input
                    className="w-full h-10 pl-3 pr-10 bg-surface border border-border text-sm focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center w-4 h-4 border border-border bg-surface group-hover:border-foreground">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
                  {remember && <div className="w-2 h-2 bg-foreground" />}
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Remember this device</span>
              </label>
            </div>

            {error && (
              <div className="p-3 border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-mono">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full h-10 bg-foreground text-background text-xs font-mono uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              {loading ? 'Authenticating...' : 'Sign in'}
            </button>
          </form>

          <div className="pt-6 border-t border-border space-y-3">
            <Link href="/signup" className="flex items-center justify-between p-3 border border-border bg-surface hover:bg-surface-hover group transition-colors">
              <span className="text-xs font-medium">Create a company workspace</span>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
            </Link>
            <Link href="/signup?mode=join" className="flex items-center justify-between p-3 border border-border bg-surface hover:bg-surface-hover group transition-colors">
              <span className="text-xs font-medium">Accept an invitation</span>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
            </Link>
          </div>

          {isDevelopment && (
            <div className="mt-12 pt-6 border-t border-border space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Demo Accounts (Local Dev)</div>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button type="button" key={a.email} onClick={(e) => {
                    setIdentifier(a.email);
                    setPassword(process.env.NEXT_PUBLIC_TEST_USER_PASSWORD ?? '');
                    signIn(e as any, a.email);
                  }}
                    className="text-[10px] font-mono border border-border bg-surface hover:bg-surface-hover px-2 py-1 text-muted-foreground hover:text-foreground transition-colors">
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
