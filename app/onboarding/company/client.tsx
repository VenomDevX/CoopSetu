'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

interface CompanyClientProps {
  connectedAccount?: { provider: 'github' | 'email'; label: string; };
}

export default function CompanyClient({ connectedAccount }: CompanyClientProps) {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [industry, setIndustry] = useState('');
  const [touched, setTouched] = useState(false);

  const isCompanyValid = companyName.length >= 2 && /^[a-zA-Z0-9\s\&\-\.]+$/.test(companyName);
  const isSlugSyntaxValid = workspaceSlug.length >= 3 && /^[a-z0-9\-]+$/.test(workspaceSlug) && !workspaceSlug.startsWith('-') && !workspaceSlug.endsWith('-') && !workspaceSlug.includes('--');
  const isFormValid = isCompanyValid && isSlugSyntaxValid && slugAvailable === true;

  // Debounced Slug Check
  const slugCheckRef = useRef<NodeJS.Timeout>(null);
  useEffect(() => {
    if (slugCheckRef.current) clearTimeout(slugCheckRef.current);
    slugCheckRef.current = setTimeout(async () => {
      if (!isSlugSyntaxValid) {
        setSlugAvailable(null);
        setCheckingSlug(false);
        return;
      }
      setCheckingSlug(true);
      try {
        const res = await fetch('/api/v1/auth/workspace-slug-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: workspaceSlug }),
        });
        const data = await res.json();
        setSlugAvailable(data.available);
      } catch {
        setSlugAvailable(false);
      } finally {
        setCheckingSlug(false);
      }
    }, isSlugSyntaxValid ? 400 : 0);
    return () => { if (slugCheckRef.current) clearTimeout(slugCheckRef.current); };
  }, [workspaceSlug, isSlugSyntaxValid]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setSlugTouched(true);
    if (!isFormValid) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          slug: workspaceSlug,
          industry: industry || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create organization');
      }

      // Make the new org active
      await fetch('/api/v1/organizations/active', {
        method: 'POST', 
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organization_id: data.data.id }),
      });

      router.push('/onboarding'); // Let central resolver redirect to team step
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      currentStep={3}
      totalSteps={4}
      stepLabel="Organization Setup"
      title="Create your workspace"
      subtitle="You will become the organization owner."
      showConnectedAccount={true}
      connectedAccount={connectedAccount}
      onBack={loading ? undefined : () => router.push('/onboarding/profile')}
    >
      <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
        {error && (
          <div className="mb-6 p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">
            {error}
          </div>
        )}

        <div className="space-y-6 w-full">
          <div className="space-y-1.5 w-full">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Company Name</label>
            <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors ${touched && !isCompanyValid ? 'border-red-500 focus:border-red-500' : isCompanyValid && touched ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
              placeholder="Apex Financial Technologies" value={companyName} onChange={(e) => { setCompanyName(e.target.value); setTouched(true); }} required autoFocus />
            {touched && !isCompanyValid && <p className="text-[10px] text-red-500 font-mono">Invalid characters. Letters, numbers, spaces, & - . allowed.</p>}
          </div>

          <div className="space-y-1.5 relative w-full">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Workspace Slug</label>
            <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors pr-10 ${slugTouched && !isSlugSyntaxValid ? 'border-red-500 focus:border-red-500' : slugAvailable === true ? 'border-green-500/50 focus:border-green-500/50' : slugAvailable === false && slugTouched ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
              placeholder="apex-financial" value={workspaceSlug} onChange={(e) => { setWorkspaceSlug(e.target.value.toLowerCase()); setSlugTouched(true); }} required onFocus={() => setSlugTouched(true)} />
            <div className="absolute right-3 top-[26px]">
              {checkingSlug ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> :
                slugAvailable === true ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : null}
            </div>
            {slugTouched && !isSlugSyntaxValid ? (
              <p className="text-[10px] text-red-500 font-mono">✕ Use lowercase letters, numbers, and hyphens only (no consecutive/leading)</p>
            ) : slugAvailable === false && slugTouched ? (
              <p className="text-[10px] text-red-500 font-mono">✕ Workspace slug already taken or reserved</p>
            ) : slugAvailable === true ? (
              <p className="text-[10px] text-green-500 font-mono">✓ Workspace slug available</p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-mono">Used in your workspace URL.</p>
            )}
          </div>

          <div className="space-y-1.5 w-full">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Industry (Optional)</label>
            <select className="w-full h-11 px-3 bg-surface border border-border rounded text-sm focus:outline-none focus:border-foreground appearance-none rounded"
              value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="" disabled>Select...</option>
              <option value="Technology">Technology</option>
              <option value="Finance">Finance</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Retail">Retail</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={!isFormValid || loading || checkingSlug} className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50 mt-4">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning Workspace...</>
          ) : (
            <>Create Organization <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </form>
    </OnboardingShell>
  );
}
