'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { OnboardingShell } from '@/components/auth/onboarding-shell';

interface PendingInvite {
  id: string;
  organizationName: string;
  roleCode: string;
}

interface InvitesClientProps {
  pendingInvites: PendingInvite[];
}

export default function InvitesClient({ pendingInvites }: InvitesClientProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (inviteId: string) => {
    setError(null);
    setLoadingId(inviteId);
    
    try {
      const res = await fetch('/api/v1/invites/reissue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to accept invitation.');
      }
      
      // Navigate to the reissued canonical invite token page which will complete the flow
      router.push(`/invite/${json.data.token}`);
    } catch (err: any) {
      setError(err.message);
      setLoadingId(null);
    }
  };

  const handleCreateWorkspace = async () => {
    // Set CREATE_WORKSPACE intent cookie via an API or just client-side cookie if safe
    document.cookie = "create_workspace_intent=true; path=/; max-age=3600; SameSite=Lax";
    router.push('/onboarding/company');
  };

  return (
    <OnboardingShell
      currentStep={1} // Just the start
      totalSteps={1}
      stepLabel="Pending Invitations"
      title="You have pending invitations"
      subtitle="Accept an invitation to join an existing workspace."
      onBack={() => router.back()}
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
        {error && (
          <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono flex items-start gap-3">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="p-5 border border-border rounded bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-foreground">{invite.organizationName}</h3>
                <p className="text-xs font-mono text-muted-foreground mt-1">Role: {invite.roleCode}</p>
              </div>
              <button 
                onClick={() => handleAccept(invite.id)}
                disabled={!!loadingId}
                className="h-10 px-6 bg-foreground text-background text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50 shrink-0"
              >
                {loadingId === invite.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Accepting...</>
                ) : (
                  <>Accept <CheckCircle2 className="w-4 h-4" /></>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border mt-8 flex flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground font-mono">Or, create your own workspace instead.</p>
          <button 
            onClick={handleCreateWorkspace}
            disabled={!!loadingId}
            className="h-10 px-6 border border-border rounded text-foreground text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Create Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
