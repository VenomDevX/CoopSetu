'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const JOB_FAMILIES = ['Engineering', 'Product', 'Project Management', 'Quality Assurance', 'Security', 'DevOps', 'Design', 'Data', 'Operations', 'Finance', 'Compliance', 'Human Resources', 'Customer Support', 'Other'];
const JOB_TITLES = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Data Scientist', 'Designer', 'Project Manager', 'Team Manager', 'Engineering Manager', 'Product Manager', 'QA Manager', 'Security Manager', 'Operations Manager', 'Other'];
const SPECIALIZATIONS = ['Frontend', 'Backend', 'Fullstack', 'Mobile', 'Machine Learning', 'Data', 'Cloud', 'Cybersecurity', 'UI/UX', 'Other'];
const MANAGER_TITLES = ['Project Manager', 'Team Manager', 'Engineering Manager', 'Product Manager', 'QA Manager', 'Security Manager', 'Operations Manager'];
const MANAGER_TYPES = ['Not a Manager', 'Project Manager', 'Team Manager', 'Engineering Manager', 'Product Manager', 'QA Manager', 'Security Manager', 'Operations Manager'];

// Allows any alphabet/script (Unicode letters + marks), not just Latin — a GitHub
// display name can be in any language and should never be rejected by default.
const nameSchema = z.string().min(1).max(100).regex(/^[\p{L}\p{M}\s'.\-]+$/u);
const usernameSyntaxSchema = z.string().min(3).max(30).regex(/^[a-z0-9\._\-]+$/).refine(s => !s.includes(' ') && !s.includes('..'));

interface ProfileClientProps {
  initialFullName: string;
  initialUsername: string;
  connectedAccount?: { provider: 'github' | 'email'; label: string; };
  needsLegalConsent?: boolean;
}

export default function ProfileClient({ initialFullName, initialUsername, connectedAccount, needsLegalConsent = false }: ProfileClientProps) {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState(initialFullName);
  const [username, setUsername] = useState(initialUsername ?? '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);

  const [jobFamily, setJobFamily] = useState('');
  const [jobTitleSelect, setJobTitleSelect] = useState('');
  const [customJobTitle, setCustomJobTitle] = useState('');
  const [specializationSelect, setSpecializationSelect] = useState('');
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [managerType, setManagerType] = useState('Not a Manager');
  const [description, setDescription] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(!needsLegalConsent);

  const isNameValid = nameSchema.safeParse(fullName).success;
  const isUsernameSyntaxValid = usernameSyntaxSchema.safeParse(username).success;
  const actualJobTitle = jobTitleSelect === 'Other' ? customJobTitle : jobTitleSelect;
  const actualSpec = specializationSelect === 'Other' ? customSpecialization : specializationSelect;
  const isJobValid = jobFamily !== '' && actualJobTitle.length >= 2 && actualSpec.length >= 2 && description.length <= 500;
  const isFormValid = isNameValid && isUsernameSyntaxValid && usernameAvailable === true && isJobValid && acceptedLegal;

  // Debounced Username
  const usernameCheckRef = useRef<NodeJS.Timeout>(null);
  useEffect(() => {
    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    usernameCheckRef.current = setTimeout(async () => {
      if (!isUsernameSyntaxValid) {
        setUsernameAvailable(null);
        setCheckingUsername(false);
        return;
      }
      setCheckingUsername(true);
      try {
        const res = await fetch('/api/v1/auth/username-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        setUsernameAvailable(data.available);
      } catch {
        setUsernameAvailable(false);
      } finally {
        setCheckingUsername(false);
      }
    }, isUsernameSyntaxValid ? 400 : 0);
    return () => { if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current); };
  }, [username, isUsernameSyntaxValid]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUsernameTouched(true);
    if (!isFormValid) return;

    setError(null);
    setLoading(true);

    try {
      if (needsLegalConsent) {
        const legalRes = await fetch('/api/v1/legal/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acceptedTerms: true, acceptedPrivacy: true, source: 'ONBOARDING_PROFILE' }),
        });
        if (!legalRes.ok) {
          const legalData = await legalRes.json();
          throw new Error(legalData.error?.message || 'Failed to record legal acceptance.');
        }
      }

      const res = await fetch('/api/v1/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          jobFamily,
          jobTitle: actualJobTitle,
          managerType: MANAGER_TITLES.includes(jobTitleSelect) ? managerType : 'Not a Manager',
          specialization: actualSpec,
          professionalDescription: description,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update profile');
      }

      router.push('/onboarding'); // Let central resolver determine next step
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      currentStep={1}
      totalSteps={3}
      stepLabel="Professional Identity"
      title="Tell us about your work"
      subtitle="How you will appear within the organization."
      showConnectedAccount={true}
      connectedAccount={connectedAccount}
    >
      <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
        {error && (
          <div className="mb-6 p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">
            {error}
          </div>
        )}

        <div className="space-y-6 w-full">
          <div className="space-y-1.5 w-full">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Full Name</label>
            <input className={`w-full h-11 px-4 bg-surface rounded-[6px] border text-sm focus:outline-none transition-colors ${!isNameValid && fullName.length > 0 ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
              type="text" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="space-y-1.5 w-full">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Username</label>
            <div className="relative">
              <input className={`w-full h-11 px-4 bg-surface rounded-[6px] border text-sm focus:outline-none transition-colors pr-10 ${usernameTouched && !isUsernameSyntaxValid ? 'border-red-500 focus:border-red-500' : usernameAvailable === true ? 'border-green-500/50 focus:border-green-500/50' : usernameAvailable === false && usernameTouched ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
                placeholder="janedoe" value={username} onChange={(e) => { setUsername(e.target.value.toLowerCase()); setUsernameTouched(true); }} required onFocus={() => setUsernameTouched(true)} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> :
                  usernameAvailable === true ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : null}
              </div>
            </div>
            {usernameTouched && !isUsernameSyntaxValid ? (
              <p className="text-[10px] text-red-500 font-mono">3–30 characters · letters, numbers, dots, underscores, and hyphens only</p>
            ) : usernameAvailable === false && usernameTouched ? (
              <p className="text-[10px] text-red-500 font-mono">✕ Username already taken or reserved</p>
            ) : usernameAvailable === true ? (
              <p className="text-[10px] text-green-500 font-mono">✓ Username available</p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-mono">3–30 characters · letters, numbers, dots, underscores, and hyphens only</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="space-y-1.5 w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Job Family</label>
              <Select value={jobFamily} onValueChange={setJobFamily} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {JOB_FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Job Title</label>
              <Select value={jobTitleSelect} onValueChange={setJobTitleSelect} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {jobTitleSelect === 'Other' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Custom Job Title</label>
              <input className="w-full h-11 px-4 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors"
                placeholder="e.g. Lead Catalyst" value={customJobTitle} onChange={(e) => setCustomJobTitle(e.target.value)} required />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="space-y-1.5 w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Specialization</label>
              <Select value={specializationSelect} onValueChange={setSpecializationSelect} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALIZATIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {MANAGER_TITLES.includes(jobTitleSelect) && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 w-full">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Manager Type</label>
                <Select value={managerType} onValueChange={setManagerType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MANAGER_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {MANAGER_TITLES.includes(jobTitleSelect) && (
            <p className="text-[10px] text-muted-foreground font-mono bg-surface p-2 border border-border rounded animate-in fade-in">
              Your job title describes your work profile. Your system authority is assigned separately by your organization.
            </p>
          )}

          {specializationSelect === 'Other' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 w-full">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Custom Specialization</label>
              <input className="w-full h-11 px-4 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors"
                placeholder="e.g. Embedded Systems" value={customSpecialization} onChange={(e) => setCustomSpecialization(e.target.value)} required />
            </div>
          )}

          <div className="space-y-1.5 w-full">
            <div className="flex justify-between">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Professional Description (Optional)</label>
              <span className="text-[10px] font-mono text-muted-foreground">{description.length} / 500</span>
            </div>
            <textarea className="w-full h-24 px-4 py-3 bg-surface border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
              placeholder="Briefly describe your responsibilities..." maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {needsLegalConsent && (
          <label className="flex items-start gap-3 cursor-pointer select-none w-full group">
            <Checkbox
              checked={acceptedLegal}
              onCheckedChange={(checked) => setAcceptedLegal(checked as boolean)}
              className="mt-0.5"
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
        )}

        <button type="submit" disabled={!isFormValid || checkingUsername || loading} className="w-full h-11 bg-foreground text-background rounded-[6px] text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ChevronRight className="w-4 h-4" /></>}
        </button>
      </form>
    </OnboardingShell>
  );
}
