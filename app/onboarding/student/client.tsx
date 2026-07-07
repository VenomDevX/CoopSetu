'use client';

import { useRouter } from 'next/navigation';
import { OnboardingShell } from '@/components/auth/onboarding-shell';
import { StudentWorkspaceChoices } from '@/components/onboarding/student-workspace-choices';

const STEPS = [
  { id: 1, label: 'Account' },
  { id: 2, label: 'Profile' },
  { id: 3, label: 'Workspace Path' },
  { id: 4, label: 'Student Setup' },
];

export default function StudentChoiceClient() {
  const router = useRouter();

  return (
    <OnboardingShell
      currentStep={4}
      totalSteps={4}
      stepLabel="Student Setup"
      title="Set up your student workspace"
      subtitle="You can always create or join another workspace later."
      steps={STEPS}
      onBack={() => router.push('/onboarding/workspace-path')}
    >
      <StudentWorkspaceChoices />
    </OnboardingShell>
  );
}
