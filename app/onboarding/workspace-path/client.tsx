'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function WorkspacePathClient() {
  const router = useRouter();

  // Since student/hackathon path is removed, auto-redirect to enterprise (company) onboarding.
  useEffect(() => {
    document.cookie = `workspace_path_intent=enterprise; path=/; max-age=3600; SameSite=Lax`;
    router.push('/onboarding/company');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Setting up your workspace...
      </div>
    </div>
  );
}
