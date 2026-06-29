'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { Logo } from '@/components/logo';
import { CheckCircle2, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';

type Step = 1 | 2 | 3;

const JOB_FAMILIES = ['Engineering', 'Product', 'Project Management', 'Quality Assurance', 'Security', 'DevOps', 'Design', 'Data', 'Operations', 'Finance', 'Compliance', 'Human Resources', 'Customer Support', 'Other'];
const JOB_TITLES = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Data Scientist', 'Designer', 'Project Manager', 'Team Manager', 'Engineering Manager', 'Product Manager', 'QA Manager', 'Security Manager', 'Operations Manager', 'Other'];
const SPECIALIZATIONS = ['Frontend', 'Backend', 'Fullstack', 'Mobile', 'Machine Learning', 'Data', 'Cloud', 'Cybersecurity', 'UI/UX', 'Other'];
const MANAGER_TITLES = ['Project Manager', 'Team Manager', 'Engineering Manager', 'Product Manager', 'QA Manager', 'Security Manager', 'Operations Manager'];
const MANAGER_TYPES = ['Not a Manager', 'Project Manager', 'Team Manager', 'Engineering Manager', 'Product Manager', 'QA Manager', 'Security Manager', 'Operations Manager'];

// Basic Zod schemas for local validation (synced with server)
const nameSchema = z.string().min(2).max(100).regex(/^[a-zA-Z\s'\-]+$/);
const emailSchema = z.string().email();
const usernameSyntaxSchema = z.string().min(3).max(30).regex(/^[a-z0-9\._\-]+$/).refine(s => !s.includes(' ') && !s.includes('..'));
const slugSyntaxSchema = z.string().min(3).max(50).regex(/^[a-z0-9\-]+$/).refine(s => !s.startsWith('-') && !s.endsWith('-') && !s.includes('--'));
const companyNameSchema = z.string().min(2).max(120).regex(/^[a-zA-Z0-9\s\&\-\.]+$/);
const customInputSchema = z.string().min(2).max(100);

export default function SignupPage() {
  const router = useRouter();

  // Global State
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched1, setTouched1] = useState(false);

  // Step 2: Professional
  const [username, setUsername] = useState('');
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
  const [touched2, setTouched2] = useState(false);

  // Step 3: Company
  const [companyName, setCompanyName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [touched3, setTouched3] = useState(false);

  // Step 1 Validation
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

  // Step 2 Validation
  const isUsernameSyntaxValid = usernameSyntaxSchema.safeParse(username).success;
  const actualJobTitle = jobTitleSelect === 'Other' ? customJobTitle : jobTitleSelect;
  const actualSpec = specializationSelect === 'Other' ? customSpecialization : specializationSelect;
  const isJobValid = jobFamily !== '' && actualJobTitle.length >= 2 && actualSpec.length >= 2 && description.length <= 500;
  const isStep2Valid = isUsernameSyntaxValid && usernameAvailable === true && isJobValid;

  // Step 3 Validation
  const isCompanyValid = companyNameSchema.safeParse(companyName).success;
  const isSlugSyntaxValid = slugSyntaxSchema.safeParse(workspaceSlug).success;
  const isStep3Valid = isCompanyValid && isSlugSyntaxValid && slugAvailable === true && industry !== '' && companySize !== '';

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

  // Debounced Slug
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

  const handleNext = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setTouched1(true);
      if (isStep1Valid) setStep(2);
    } else if (step === 2) {
      setTouched2(true);
      setUsernameTouched(true);
      if (isStep2Valid) setStep(3);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setTouched3(true);
    setSlugTouched(true);
    if (!isStep3Valid) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, email, password, confirmPassword,
          username, jobFamily, jobTitle: actualJobTitle,
          managerType: MANAGER_TITLES.includes(jobTitleSelect) ? managerType : 'Not a Manager',
          specialization: actualSpec, professionalDescription: description,
          companyName, workspaceSlug, industry, companySize,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to sign up');
      }

      router.push(data.redirectUrl || '/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
      {/* LEFT: Branding & Info (45%) */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] border-r border-border bg-surface relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

        <div className="p-12 relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <Logo width={32} height={32} />
            <span className="uppercase tracking-widest text-base font-bold">HANDOFF</span>
          </div>

          <h1 className="text-4xl font-semibold leading-tight mb-6 tracking-tight">
            Enterprise work management,<br />precision engineered.
          </h1>
          <p className="text-muted-foreground text-lg mb-12 max-w-md leading-relaxed">
            Unify your product, engineering, and operations teams into a single, cohesive delivery machine.
          </p>

          <div className="space-y-6">
            <div className={`flex items-center gap-4 transition-opacity duration-300 ${step >= 1 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle2 className={`w-5 h-5 ${step > 1 ? 'text-foreground' : 'text-muted-foreground'}`} />
              <div className="flex flex-col">
                <span className="font-mono text-xs uppercase tracking-widest">Step 01</span>
                <span className="text-sm font-medium">Account Details</span>
              </div>
            </div>
            <div className={`flex items-center gap-4 transition-opacity duration-300 ${step >= 2 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle2 className={`w-5 h-5 ${step > 2 ? 'text-foreground' : 'text-muted-foreground'}`} />
              <div className="flex flex-col">
                <span className="font-mono text-xs uppercase tracking-widest">Step 02</span>
                <span className="text-sm font-medium">Professional Identity</span>
              </div>
            </div>
            <div className={`flex items-center gap-4 transition-opacity duration-300 ${step >= 3 ? 'opacity-100' : 'opacity-40'}`}>
              <CheckCircle2 className={`w-5 h-5 ${step === 3 && loading ? 'text-foreground' : 'text-muted-foreground'}`} />
              <div className="flex flex-col">
                <span className="font-mono text-xs uppercase tracking-widest">Step 03</span>
                <span className="text-sm font-medium">Organization Setup</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-12 relative z-10 flex gap-4">
          <span className="px-3 py-1 bg-background border border-border text-[10px] font-mono uppercase tracking-widest rounded-sm">SOC2 Type II</span>
          <span className="px-3 py-1 bg-background border border-border text-[10px] font-mono uppercase tracking-widest rounded-sm">End-to-End Encrypted</span>
        </div>
      </div>

      {/* RIGHT: Form Area (55%) */}
      <div className="w-full lg:w-[55%] flex flex-col relative overflow-y-auto">
        <div className="absolute top-6 right-8 text-sm font-mono text-muted-foreground z-10">
          Already have an account? <Link href="/login" className="text-foreground border-b border-foreground hover:opacity-80 transition-opacity pb-0.5">Sign in</Link>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto px-6 py-24 min-h-full">
          {error && (
            <div className="mb-6 p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono animate-in fade-in">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Create your account</h2>
                <p className="text-muted-foreground text-sm">Enter your personal details to get started.</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Full Name</label>
                    <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && !isNameValid ? 'border-red-500 focus:border-red-500' : isNameValid && touched1 ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                      placeholder="Jane Doe" value={fullName} onChange={(e) => { setFullName(e.target.value); setTouched1(true); }} required autoFocus />
                    {touched1 && !isNameValid && <p className="text-[10px] text-red-500 font-mono">Letters, spaces, hyphens only (min 2)</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Work Email</label>
                    <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && !isEmailValid ? 'border-red-500 focus:border-red-500' : isEmailValid && touched1 ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                      type="email" placeholder="jane@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setTouched1(true); }} required />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Password</label>
                      <input className={`w-full h-11 px-4 pr-10 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && !passLength ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
                        type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setTouched1(true)} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 bottom-0 h-11 flex items-center text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Confirm Password</label>
                      <input className={`w-full h-11 px-4 pr-10 bg-surface border text-sm focus:outline-none transition-colors ${touched1 && password.length > 0 && !passMatch ? 'border-red-500 focus:border-red-500' : passMatch ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                        type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                      {passMatch && <span className="absolute right-3 bottom-0 h-11 flex items-center pointer-events-none"><CheckCircle2 className="w-4 h-4 text-green-500" /></span>}
                    </div>
                  </div>

                  {/* Live Password Checklist */}
                  <div className="bg-surface p-4 border border-border space-y-3">
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

              <button type="submit" disabled={!isStep1Valid} className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNext} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8 flex items-center gap-4">
                <button type="button" onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground text-sm font-mono">&larr; Back</button>
                <div>
                  <h2 className="text-2xl font-semibold mb-1">Professional Identity</h2>
                  <p className="text-muted-foreground text-sm">How you will appear within the organization.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Username</label>
                  <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors pr-10 ${usernameTouched && !isUsernameSyntaxValid ? 'border-red-500 focus:border-red-500' : usernameAvailable === true ? 'border-green-500/50 focus:border-green-500/50' : usernameAvailable === false && usernameTouched ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
                    placeholder="janedoe" value={username} onChange={(e) => { setUsername(e.target.value.toLowerCase()); setUsernameTouched(true); }} required onFocus={() => setUsernameTouched(true)} />
                  <div className="absolute right-3 top-[26px]">
                    {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> :
                      usernameAvailable === true ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : null}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Job Family</label>
                    <select className="w-full h-11 px-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground appearance-none rounded-none"
                      value={jobFamily} onChange={(e) => { setJobFamily(e.target.value); setTouched2(true); }} required>
                      <option value="" disabled>Select...</option>
                      {JOB_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Job Title</label>
                    <select className="w-full h-11 px-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground appearance-none rounded-none"
                      value={jobTitleSelect} onChange={(e) => { setJobTitleSelect(e.target.value); setTouched2(true); }} required>
                      <option value="" disabled>Select...</option>
                      {JOB_TITLES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                {jobTitleSelect === 'Other' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Custom Job Title</label>
                    <input className="w-full h-11 px-4 bg-surface border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      placeholder="e.g. Lead Catalyst" value={customJobTitle} onChange={(e) => setCustomJobTitle(e.target.value)} required />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Specialization</label>
                    <select className="w-full h-11 px-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground appearance-none rounded-none"
                      value={specializationSelect} onChange={(e) => { setSpecializationSelect(e.target.value); setTouched2(true); }} required>
                      <option value="" disabled>Select...</option>
                      {SPECIALIZATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  {MANAGER_TITLES.includes(jobTitleSelect) && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Manager Type</label>
                      <select className="w-full h-11 px-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground appearance-none rounded-none"
                        value={managerType} onChange={(e) => setManagerType(e.target.value)}>
                        {MANAGER_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {MANAGER_TITLES.includes(jobTitleSelect) && (
                  <p className="text-[10px] text-muted-foreground font-mono bg-surface p-2 border border-border animate-in fade-in">
                    Your job title describes your work profile. Your system authority is assigned separately by your organization.
                  </p>
                )}

                {specializationSelect === 'Other' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Custom Specialization</label>
                    <input className="w-full h-11 px-4 bg-surface border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      placeholder="e.g. Embedded Systems" value={customSpecialization} onChange={(e) => setCustomSpecialization(e.target.value)} required />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Professional Description (Optional)</label>
                    <span className="text-[10px] font-mono text-muted-foreground">{description.length} / 500</span>
                  </div>
                  <textarea className="w-full h-24 px-4 py-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
                    placeholder="Briefly describe your responsibilities..." maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <button type="submit" disabled={!isStep2Valid || checkingUsername} className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSignup} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8 flex items-center gap-4">
                <button type="button" onClick={() => setStep(2)} className="text-muted-foreground hover:text-foreground text-sm font-mono">&larr; Back</button>
                <div>
                  <h2 className="text-2xl font-semibold mb-1">Organization Setup</h2>
                  <p className="text-muted-foreground text-sm">Create the workspace for your company.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Company Name</label>
                  <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors ${touched3 && !isCompanyValid ? 'border-red-500 focus:border-red-500' : isCompanyValid && touched3 ? 'border-green-500/50 focus:border-green-500/50' : 'border-border focus:border-foreground'}`}
                    placeholder="Apex Financial Technologies" value={companyName} onChange={(e) => { setCompanyName(e.target.value); setTouched3(true); }} required autoFocus />
                  {touched3 && !isCompanyValid && <p className="text-[10px] text-red-500 font-mono">Invalid characters. Letters, numbers, spaces, & - . allowed.</p>}
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Workspace Slug</label>
                  <input className={`w-full h-11 px-4 bg-surface border text-sm focus:outline-none transition-colors pr-10 ${slugTouched && !isSlugSyntaxValid ? 'border-red-500 focus:border-red-500' : slugAvailable === true ? 'border-green-500/50 focus:border-green-500/50' : slugAvailable === false && slugTouched ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'}`}
                    placeholder="apex-financial" value={workspaceSlug} onChange={(e) => { setWorkspaceSlug(e.target.value); setSlugTouched(true); }} required onFocus={() => setSlugTouched(true)} />
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Industry</label>
                    <select className="w-full h-11 px-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground appearance-none rounded-none"
                      value={industry} onChange={(e) => { setIndustry(e.target.value); setTouched3(true); }} required>
                      <option value="" disabled>Select...</option>
                      <option value="Technology">Technology</option>
                      <option value="Finance">Finance</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Retail">Retail</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Company Size</label>
                    <select className="w-full h-11 px-3 bg-surface border border-border text-sm focus:outline-none focus:border-foreground appearance-none rounded-none"
                      value={companySize} onChange={(e) => { setCompanySize(e.target.value); setTouched3(true); }} required>
                      <option value="" disabled>Select...</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={!isStep3Valid || loading || checkingSlug} className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50 mt-4">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning Workspace...</>
                ) : (
                  'Create Organization'
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
