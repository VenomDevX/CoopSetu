'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { contactRequestSchema, companySizeEnum, topicEnum } from '@/lib/validation/contact';
import { PublicFooter } from '@/components/layout/public-footer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ContactPage() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navType, setNavType] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companySize, setCompanySize] = useState<string>('1-10');
  const [role, setRole] = useState('');
  const [topic, setTopic] = useState<string>('Request a Demo');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // UI / Status State
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleNavigate = (path: string, type: string) => {
    setNavType(type);
    setIsNavigating(true);
    router.push(path);
  };

  const validateForm = () => {
    const data = {
      fullName,
      workEmail,
      companyName,
      companySize,
      role,
      topic,
      message,
      honeypot,
    };

    const res = contactRequestSchema.safeParse(data);
    if (res.success) {
      setErrors({});
      return true;
    } else {
      const formattedErrors: Record<string, string> = {};
      res.error.issues.forEach((err) => {
        if (err.path[0]) {
          formattedErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(formattedErrors);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          workEmail,
          companyName,
          companySize,
          role,
          topic,
          message,
          honeypot,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitStatus('success');
        // Clear form
        setFullName('');
        setWorkEmail('');
        setCompanyName('');
        setRole('');
        setMessage('');
        setHoneypot('');
      } else {
        setSubmitStatus('error');
        setErrorMessage(data.error || 'An error occurred during submission.');
      }
    } catch (err) {
      setSubmitStatus('error');
      setErrorMessage('Could not connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-200">
      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-24">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* HERO SECTION */}
          <section className="mb-16 border-b border-border pb-10">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-foreground rounded-full" />
              CONTACT_HANDOFF
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1] max-w-4xl">
              Talk to the Handoff team.
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
              Tell us about your organization, delivery workflow, or enterprise requirements.
            </p>
          </section>

          {/* FORM SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            
            {/* Left Side: Form */}
            <div className="lg:col-span-2">
              {submitStatus === 'success' && (
                <div className="border border-border rounded p-8 mb-8 bg-surface-hover flex flex-col gap-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <CheckCircle2 className="w-5 h-5 text-foreground" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">SUBMISSION_RECEIVED</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Thank you. Your message has been securely transmitted. Our team will review your request and follow up shortly.
                  </p>
                  <Button 
                    onClick={() => setSubmitStatus('idle')}
                    className="border border-border rounded bg-transparent text-foreground hover:bg-surface rounded h-10 px-6 text-xs font-mono uppercase tracking-widest self-start mt-2"
                  >
                    Send another message
                  </Button>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="border border-red-500/30 p-8 mb-8 bg-red-950/10 flex flex-col gap-4">
                  <div className="flex items-center gap-3 text-red-500">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">SUBMISSION_ERROR</span>
                  </div>
                  <p className="text-sm text-red-400 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              )}

              {submitStatus !== 'success' && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  
                  {/* Honeypot field (hidden from screen reader and visual layout) */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="honeypot">Leave this field blank</label>
                    <input 
                      type="text" 
                      id="honeypot" 
                      name="honeypot" 
                      value={honeypot} 
                      onChange={(e) => setHoneypot(e.target.value)} 
                      tabIndex={-1} 
                      autoComplete="off" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="fullName" className="text-foreground font-bold">Full Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-transparent border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-foreground rounded uppercase"
                        required
                        disabled={isLoading}
                      />
                      {errors.fullName && <span className="text-red-500 text-[10px] tracking-normal font-sans normal-case mt-1">{errors.fullName}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="workEmail" className="text-foreground font-bold">Work Email <span className="text-red-500">*</span></label>
                      <input 
                        type="email"
                        id="workEmail"
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        className="bg-transparent border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-foreground rounded lowercase"
                        required
                        disabled={isLoading}
                      />
                      {errors.workEmail && <span className="text-red-500 text-[10px] tracking-normal font-sans normal-case mt-1">{errors.workEmail}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="companyName" className="text-foreground font-bold">Company Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="bg-transparent border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-foreground rounded uppercase"
                        required
                        disabled={isLoading}
                      />
                      {errors.companyName && <span className="text-red-500 text-[10px] tracking-normal font-sans normal-case mt-1">{errors.companyName}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="companySize" className="text-foreground font-bold">Company Size <span className="text-red-500">*</span></label>
                      <Select value={companySize} onValueChange={setCompanySize} disabled={isLoading} required>
                        <SelectTrigger className="bg-transparent border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-foreground uppercase min-h-[46px]">
                          <SelectValue placeholder="Select Company Size" />
                        </SelectTrigger>
                        <SelectContent>
                          {companySizeEnum.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.companySize && <span className="text-red-500 text-[10px] tracking-normal font-sans normal-case mt-1">{errors.companySize}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="role" className="text-foreground font-bold">Your Role <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="bg-transparent border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-foreground rounded uppercase"
                        required
                        disabled={isLoading}
                      />
                      {errors.role && <span className="text-red-500 text-[10px] tracking-normal font-sans normal-case mt-1">{errors.role}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="topic" className="text-foreground font-bold">Topic <span className="text-red-500">*</span></label>
                      <Select value={topic} onValueChange={setTopic} disabled={isLoading} required>
                        <SelectTrigger className="bg-transparent border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-foreground min-h-[46px]">
                          <SelectValue placeholder="Select Topic" />
                        </SelectTrigger>
                        <SelectContent>
                          {topicEnum.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.topic && <span className="text-red-500 text-[10px] tracking-normal font-sans normal-case mt-1">{errors.topic}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="message" className="text-foreground font-bold">Message <span className="text-red-500">*</span></label>
                    <textarea 
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="bg-transparent border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-foreground rounded h-40 uppercase"
                      maxLength={3000}
                      required
                      disabled={isLoading}
                    />
                    <div className="flex justify-between items-center mt-1">
                      {errors.message ? (
                        <span className="text-red-500 text-[10px] tracking-normal font-sans normal-case">{errors.message}</span>
                      ) : <div />}
                      <span className="text-[10px] text-muted-foreground/60">{message.length}/3000 CHARS</span>
                    </div>
                  </div>

                  <p className="text-[10px] tracking-wide text-muted-foreground/60 leading-relaxed font-sans normal-case max-w-xl">
                    By submitting this form, you agree that Handoff may use your information to respond to your request.
                  </p>

                  <Button 
                    type="submit"
                    className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs self-start"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Message'}
                  </Button>

                </form>
              )}
            </div>

            {/* Right Side: Sidebar Info */}
            <div className="border border-border rounded p-8 flex flex-col gap-8 h-fit bg-surface/30">
              <div>
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-3">Enterprise Sales</span>
                <p className="text-sm text-foreground leading-relaxed font-sans">
                  Interested in setting up Handoff for custom roles, strict audit trails, or complex delivery pipelines? Get in touch with our solutions engineers.
                </p>
              </div>

              <div className="border-t border-border pt-6">
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-3">Audits & Reports</span>
                <p className="text-sm text-foreground leading-relaxed font-sans">
                  If you need specialized compliance documentation, SOC-2 readiness queries, or security architecture reviews, select the **Security Question** topic.
                </p>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <PublicFooter />

      {/* Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface border border-border rounded p-8 flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
            <Loader2 className="w-8 h-8 text-foreground animate-spin mb-6" />
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Navigating to workspace...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
