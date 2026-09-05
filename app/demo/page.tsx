'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ShieldCheck, Building2, User, UserCheck, BriefcaseBusiness } from 'lucide-react';

import { DEMO_PERSONAS } from '@/lib/demo/provision-demo-workspace';

const ROLE_ICONS: Record<string, any> = {
  'SUPER_ADMIN': ShieldCheck,
  'INSTITUTE_ADMIN': Building2,
  'TRAINER': User,
  'TRAINEE': UserCheck,
  'EMPLOYER': BriefcaseBusiness,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'SUPER_ADMIN': 'Full visibility into all institutes, programs, and system analytics.',
  'INSTITUTE_ADMIN': 'Manage your institute, batches, trainers, and trainees.',
  'TRAINER': 'Mark attendance, manage your batches, and track trainee progress.',
  'TRAINEE': 'View schedule, access learning materials, and apply for jobs.',
  'EMPLOYER': 'Post job opportunities and recruit from the talent pool.',
};

export default function DemoPage() {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Auto-logout if a demo user navigates back to the demo selection page
  useEffect(() => {
    // If they hit this page and have a demo session cookie, exit it
    const isDemo = document.cookie.includes('CoopSetu_demo_session=true');
    if (isDemo) {
      fetch('/api/v1/demo/exit', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' } 
      }).then(() => {
        router.refresh();
      });
    } else {
      // Just in case they have a stale session without the cookie, 
      // check if we can proactively clear it so the API doesn't fail.
      const checkSession = async () => {
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // We have a session but no cookie. We should sign them out so they can start a fresh demo.
            await supabase.auth.signOut();
            router.refresh();
          }
        } catch (e) {
          // ignore
        }
      };
      checkSession();
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
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
        <div className="h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>
      
      {/* Back Button */}
      <button 
        onClick={() => router.back()} 
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-mono uppercase tracking-widest"
      >
        <span>&larr;</span> BACK
      </button>

      <div className="max-w-3xl w-full z-10 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-tighter">
            CHOOSE YOUR ROLE
          </h1>
          <div className="space-y-2 max-w-2xl mx-auto">
            <p className="text-zinc-400 font-mono text-xs leading-relaxed">
              Experience CoopSetu through the lens of different team members. Each role has distinct permissions and visibility.
            </p>
            <p className="text-zinc-600 font-mono text-[10px] leading-relaxed">
              Demo usage is subject to our Terms of Service and Privacy Policy. AI features remain disabled in demo mode.
            </p>
          </div>
          {error && (
            <div className="text-red-500 font-mono text-xs border border-red-500/30 bg-red-500/10 p-4 max-w-md mx-auto rounded flex flex-col items-center gap-3">
              <span className="text-center">{error}</span>
              {(error.includes('active demo session') || error.includes('logged into a real account')) && (
                <button
                  onClick={async () => {
                    await fetch('/api/v1/demo/exit', { method: 'POST' });
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 rounded transition-colors uppercase tracking-widest text-[10px]"
                >
                  Force Clear Session
                </button>
              )}
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
                className={`group w-full p-3.5 bg-[#111111] hover:bg-[#1a1a1a] border border-[#222222] transition-all flex flex-col sm:flex-row items-start sm:items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed rounded-lg ${isLoading ? 'animate-pulse' : ''}`}
              >
                <div className="p-2.5 rounded-md bg-[#1c1c1c] border border-[#2a2a2a] group-hover:bg-[#252525] group-hover:border-[#333333] shrink-0 transition-colors">
                  <Icon className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" />
                </div>
                
                <div className="flex-1 space-y-1 py-0.5">
                  <h3 className="font-bold text-sm uppercase tracking-tight text-white">{persona.title}</h3>
                  <p className="text-zinc-600 text-[10px] font-mono">{persona.name}</p>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    {isLoading ? 'Provisioning workspace...' : ROLE_DESCRIPTIONS[persona.role]}
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
