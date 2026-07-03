'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle, ShieldCheck, Code2, TestTube2, AlertCircle } from 'lucide-react';

import { DEMO_PERSONAS } from '@/lib/demo/provision-demo-workspace';

const ROLE_ICONS: Record<string, any> = {
  'ORG_ADMIN': ShieldCheck,
  'PROJECT_MANAGER': CheckCircle,
  'QA_ENGINEER': TestTube2,
  'DEVELOPER': Code2,
  'SECURITY_ENGINEER': AlertCircle,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'ORG_ADMIN': 'Full visibility into all projects, settings, and team structure.',
  'PROJECT_MANAGER': 'Plan sprints, assign work, and track project health.',
  'QA_ENGINEER': 'Verify releases, open bugs, and manage test coverage.',
  'DEVELOPER': 'Execute tasks, update statuses, and link pull requests.',
  'SECURITY_ENGINEER': 'Review code changes and conduct compliance audits.',
};

export default function DemoPage() {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Auto-logout if a demo user navigates back to the demo selection page
  useEffect(() => {
    const isDemo = document.cookie.includes('handoff_demo_session=true');
    if (isDemo) {
      fetch('/api/v1/demo/exit', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' } 
      }).then(() => {
        router.refresh();
      });
    }
  }, [router]);

  const startDemo = async (role: string) => {
    setLoadingRole(role);
    setError('');
    
    try {
      const res = await fetch('/api/v1/demo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to start demo.');
      }
      
      if (json.data?.redirectUrl) {
        window.location.assign(json.data.redirectUrl);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
        <div className="h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>
      
      <div className="max-w-5xl w-full z-10 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tighter">
            Choose Your Role
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-xl mx-auto">
            Experience Handoff through the lens of different team members. 
            Each role has distinct permissions and visibility.
          </p>
          {error && (
            <div className="text-red-500 font-mono text-sm border border-red-500/50 bg-red-500/10 p-3 max-w-md mx-auto">
              {error}
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2 w-full max-w-2xl mx-auto">
          {DEMO_PERSONAS.map((persona) => {
            const Icon = ROLE_ICONS[persona.role] || Bot;
            const isLoading = loadingRole === persona.role;
            const isDisabled = loadingRole !== null && loadingRole !== persona.role;
            
            return (
              <button 
                key={persona.role}
                onClick={() => startDemo(persona.role)}
                disabled={isDisabled || isLoading}
                className={`group w-full p-4 bg-zinc-950 border border-zinc-800 hover:bg-white hover:border-white transition-colors flex flex-col sm:flex-row items-start sm:items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed ${isLoading ? 'animate-pulse' : ''}`}
              >
                <div className="p-3 bg-zinc-900 border border-zinc-800 group-hover:bg-zinc-100 group-hover:border-zinc-200 shrink-0 transition-colors">
                  <Icon className="w-5 h-5 text-zinc-300 group-hover:text-black transition-colors" />
                </div>
                
                <div className="flex-1">
                  <h3 className="font-bold text-sm uppercase tracking-tight text-white group-hover:text-black transition-colors">{persona.title}</h3>
                  <p className="text-zinc-500 group-hover:text-zinc-600 text-[10px] font-mono mt-0.5 transition-colors">{persona.name}</p>
                  <p className="text-xs text-zinc-400 group-hover:text-zinc-700 mt-1.5 transition-colors">
                    {isLoading ? 'PROVISIONING...' : ROLE_DESCRIPTIONS[persona.role]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
