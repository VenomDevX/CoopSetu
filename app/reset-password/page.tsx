import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OnboardingShell } from '@/components/auth/onboarding-shell';
import ResetPasswordClient from './client';

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <OnboardingShell currentStep={1} totalSteps={1} stepLabel="Account Recovery" title="This link is invalid or expired">
        <div className="bg-surface p-6 border border-border rounded text-center space-y-4 rounded-sm">
          <p className="text-sm text-muted-foreground">Password reset links expire after a short time and can only be used once. Request a new one.</p>
          <Link href="/forgot-password" className="text-xs font-mono uppercase tracking-widest underline hover:opacity-80">
            Request a new link
          </Link>
        </div>
      </OnboardingShell>
    );
  }

  return <ResetPasswordClient />;
}
