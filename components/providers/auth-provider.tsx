'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  isCheckingAuth: boolean;
  isLoggedIn: boolean;
  userName: string | null;
  avatarUrl: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    // The user whose profile is currently loaded. Supabase emits SIGNED_IN for
    // the session it restores on page load, right after our own initial check,
    // and TOKEN_REFRESHED every hour; neither changes who is signed in, so
    // re-fetching the user and profile on them only doubled every page load.
    let loadedUserId: string | null = null;
    let inFlight: Promise<void> | null = null;

    const checkAuth = async () => {
      const isDemo = document.cookie.includes('CoopSetu_demo_session=true');
      if (isDemo) {
        await fetch('/api/v1/demo/exit', { method: 'POST' });
        setIsLoggedIn(false);
        setUserName(null);
        setAvatarUrl(null);
        setIsCheckingAuth(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      
      if (data.user) {
        loadedUserId = data.user.id;
        setIsLoggedIn(true);
        const { data: profile } = await supabase.from('profiles').select('full_name, email, avatar_path').eq('id', data.user.id).single();
        const name = profile?.full_name || profile?.email || data.user?.email || 'User';
        setUserName(name);
        
        const oauthAvatar = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture;
        if (profile?.avatar_path) {
          setAvatarUrl(profile.avatar_path);
        } else if (oauthAvatar) {
          setAvatarUrl(oauthAvatar);
        }
      } else {
        loadedUserId = null;
        setIsLoggedIn(false);
        setUserName(null);
        setAvatarUrl(null);
      }
      setIsCheckingAuth(false);
    };

    const refresh = () => {
      inFlight = checkAuth().finally(() => { inFlight = null; });
      return inFlight;
    };

    refresh();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
       if (event === 'SIGNED_OUT') {
         loadedUserId = null;
         setIsLoggedIn(false);
         setUserName(null);
         setAvatarUrl(null);
       } else if (event === 'USER_UPDATED') {
         refresh();
       } else if (event === 'SIGNED_IN') {
         // Compare only once any check already running has recorded its user.
         const userId = session?.user.id ?? null;
         void (inFlight ?? Promise.resolve()).then(() => {
           if (userId !== loadedUserId) refresh();
         });
       }
    });

    return () => {
       subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserName(null);
    setAvatarUrl(null);
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ isCheckingAuth, isLoggedIn, userName, avatarUrl, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
