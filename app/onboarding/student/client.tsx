'use client';

import { useRouter } from 'next/navigation';
import { OnboardingShell } from '@/components/auth/onboarding-shell';
import { StudentWorkspaceChoices } from '@/components/onboarding/student-workspace-choices';

export default function StudentChoiceClient() {
  const router = useRouter();

  return (
    <OnboardingShell
      currentStep={3}
      totalSteps={4}
      stepLabel="Student Setup"
      title="Set up your student workspace"
      subtitle="You can always create or join another workspace later."
      onBack={() => router.push('/onboarding/workspace-path')}
    >
      <StudentWorkspaceChoices />
    </OnboardingShell>
  );
}
