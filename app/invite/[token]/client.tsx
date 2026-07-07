'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronRight, XCircle } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

interface InviteClientProps {
  token: string;
  initialData: any;
  error?: string;
  currentUserEmail?: string;
}

export default function InviteClient({ token, initialData, error: loadError, currentUserEmail }: InviteClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(loadError || null);
  const [loading, setLoading] = useState(false);

  const isInvalid = !initialData || loadError || initialData.status !== 'PENDING' || initialData.is_expired;
  const isEmailMismatch = initialData && currentUserEmail && initialData.email.toLowerCase() !== currentUserEmail.toLowerCase();

  const handleAccept = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const res = await fetch('/api/v1/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to accept invitation.');
      }
      
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      currentStep={1}
      totalSteps={1}
      stepLabel="Workspace Invitation"
      title={initialData?.organization_name ? `Join ${initialData.organization_name}` : 'Invalid Invitation'}
      subtitle={
        isInvalid 
          ? 'This invitation is no longer valid or has expired.' 
          : isEmailMismatch 
            ? 'This invitation was sent to a different email address.'
            : `You have been invited to join as ${initialData.role_code}.`
      }
    >
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
        {error && (
          <div className="mb-6 p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono flex items-start gap-3">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!isInvalid && isEmailMismatch && (
          <div className="mb-6 p-4 border border-orange-500/50 bg-orange-500/10 text-orange-500 text-sm font-mono">
            Please sign in with {initialData.email} to accept this invitation.
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={handleAccept}
            disabled={loading || isInvalid || !!isEmailMismatch}
            className="w-full h-11 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Accepting...</>
            ) : (
              <>Accept Invitation <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
          
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full h-11 border border-border text-foreground text-xs font-mono uppercase tracking-widest flex items-center justify-center hover:bg-surface-hover transition-colors"
          >
            Decline or Go to Dashboard
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
