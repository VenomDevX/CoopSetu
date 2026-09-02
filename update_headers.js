const fs = require('fs');
const path = require('path');

const pageTsxPath = path.join('app', 'page.tsx');
let pageTsxContent = fs.readFileSync(pageTsxPath, 'utf-8');

const marketingHeaderCode = `'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, LayoutDashboard, Settings, User, LogOut, Loader2 } from 'lucide-react';

import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function MarketingHeader({ animated = false }: { animated?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navType, setNavType] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkDemoAndLogout = () => {
      setIsNavigating(false);
      const isDemo = document.cookie.includes('handoff_demo_session=true');
      if (isDemo) {
        fetch('/api/v1/demo/exit', { method: 'POST' }).then(() => {
          setIsLoggedIn(false);
          setUserName(null);
          router.refresh();
        });
      } else {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) {
            setIsLoggedIn(true);
            supabase.from('profiles').select('full_name, email, avatar_path').eq('id', data.user.id).single().then(({ data: profile }) => {
              const name = profile?.full_name || profile?.email || data.user?.email || 'User';
              setUserName(name);
              if (profile?.avatar_path) setAvatarUrl(profile.avatar_path);
            });
          } else {
            setIsLoggedIn(false);
            setUserName(null);
          }
        });
      }
    };
    checkDemoAndLogout();
    window.addEventListener('pageshow', checkDemoAndLogout);
    return () => window.removeEventListener('pageshow', checkDemoAndLogout);
  }, [pathname, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserName(null);
    setAvatarUrl(null);
    router.refresh();
  };

  const handleNavigate = (path: string, type: string) => {
    setIsNavigating(true);
    setNavType(type);
    router.push(path);
  };

  const headerContent = (
    <div className="w-full px-6 md:px-12 h-16 flex items-center justify-between">
      <div className="flex items-center gap-12">
        <Link href="/" className="font-bold text-lg tracking-tight flex items-center gap-3">
          <Logo width={24} height={24} />
          <span className="uppercase tracking-widest text-xs">HANDOFF</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Link href="/product" className={\`\${pathname === '/product' ? 'text-foreground' : 'hover:text-foreground'} transition-colors\`}>Product</Link>
          <Link href="/solutions" className={\`\${pathname === '/solutions' ? 'text-foreground' : 'hover:text-foreground'} transition-colors\`}>Solutions</Link>
          <Link href="/ai" className={\`\${pathname === '/ai' ? 'text-foreground' : 'hover:text-foreground'} transition-colors\`}>AI</Link>
          <Link href="/security" className={\`\${pathname === '/security' ? 'text-foreground' : 'hover:text-foreground'} transition-colors\`}>Security</Link>
          <Link href="/enterprise" className={\`\${pathname === '/enterprise' ? 'text-foreground' : 'hover:text-foreground'} transition-colors\`}>Enterprise</Link>
          <Link href="/pricing" className={\`\${pathname === '/pricing' ? 'text-foreground' : 'hover:text-foreground'} transition-colors\`}>Pricing</Link>
        </nav>
      </div>
      <div className="flex items-center gap-4 md:gap-6">
        <ThemeToggle />
        {isLoggedIn ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="group flex items-center gap-2.5 py-1 transition-all duration-200 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-accent/20 overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  userName ? userName.charAt(0).toUpperCase() : 'U'
                )}
              </span>
              <span className="hidden md:block truncate max-w-[96px]">
                {userName ? userName.split(' ')[0] : 'User'}
              </span>
              <ChevronDown className={\`w-3 h-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-transform duration-200 \${userDropdownOpen ? 'rotate-180' : ''}\`} />
            </button>

            <AnimatePresence>
              {userDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-background border border-border rounded shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-mono uppercase tracking-widest text-foreground truncate">{userName || 'User'}</p>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">Workspace</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setUserDropdownOpen(false); handleNavigate('/dashboard', 'dashboard'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                    </button>
                    <button
                      onClick={() => { setUserDropdownOpen(false); handleNavigate('/dashboard/settings', 'settings'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" /> Settings
                    </button>
                    <button
                      onClick={() => { setUserDropdownOpen(false); handleNavigate('/dashboard/profile', 'profile'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <User className="w-3.5 h-3.5" /> Profile
                    </button>
                  </div>
                  <div className="border-t border-border py-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-surface-hover transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleNavigate('/login', 'signin')}
              disabled={isNavigating}
              className="hidden md:flex text-xs font-mono uppercase tracking-widest hover:text-foreground text-muted-foreground transition-colors disabled:opacity-50 items-center gap-2"
            >
              {isNavigating && navType === 'signin' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Sign In
            </button>
            <Button
              onClick={() => handleNavigate('/demo', 'demo')}
              disabled={isNavigating}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-8 px-4 md:px-6 text-xs font-mono uppercase tracking-widest transition-all w-auto md:w-40"
            >
              {isNavigating && navType === 'demo' ? (
                <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> LOADING...</span>
              ) : (
                <span className="hidden sm:inline">Request Demo</span>
              )}
              {!(isNavigating && navType === 'demo') && <span className="sm:hidden">Demo</span>}
            </Button>
          </>
        )}

        <MobileNavDrawer
          links={[
            { href: '/product', label: 'Product' },
            { href: '/solutions', label: 'Solutions' },
            { href: '/ai', label: 'AI' },
            { href: '/security', label: 'Security' },
            { href: '/enterprise', label: 'Enterprise' },
            { href: '/pricing', label: 'Pricing' },
          ]}
          onSignIn={() => handleNavigate('/dashboard', 'signin')}
          isNavigating={isNavigating}
        />
      </div>
    </div>
  );

  const className = "fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl";

  if (animated) {
    return (
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={className}
      >
        {headerContent}
      </motion.header>
    );
  }

  return <header className={className}>{headerContent}</header>;
}
`;

fs.writeFileSync(path.join('components', 'layout', 'marketing-header.tsx'), marketingHeaderCode);

const headerRegex = /<motion\.header[\s\S]*?<\/motion\.header>/;
pageTsxContent = pageTsxContent.replace(headerRegex, '<MarketingHeader animated />');
pageTsxContent = pageTsxContent.replace(/import \{ MobileNavDrawer \} from '@\/components\/layout\/mobile-nav-drawer';\n/, '');
pageTsxContent = pageTsxContent.replace(/import \{ ThemeToggle \} from '@\/components\/theme-toggle';\n/, '');
pageTsxContent = pageTsxContent.replace(/import \{ Logo \} from '@\/components\/logo';/, "import { Logo } from '@/components/logo';\nimport { MarketingHeader } from '@/components/layout/marketing-header';");

fs.writeFileSync(pageTsxPath, pageTsxContent);

const marketingPages = [
  'product', 'solutions', 'ai', 'security', 'enterprise', 'pricing', 'about', 'contact', 'privacy', 'terms', 'cookies'
];

marketingPages.forEach(page => {
  const pPath = path.join('app', page, 'page.tsx');
  if (fs.existsSync(pPath)) {
    let content = fs.readFileSync(pPath, 'utf-8');
    const pageHeaderRegex = /<header className="fixed top-0 z-50[\s\S]*?<\/header>/;
    content = content.replace(pageHeaderRegex, '<MarketingHeader />');
    if (!content.includes('MarketingHeader')) {
       console.log('MarketingHeader replacement failed in ' + page);
    } else {
       if (!content.includes("import { MarketingHeader }")) {
         content = content.replace(/import \{ Logo \} from '@\/components\/logo';/, "import { Logo } from '@/components/logo';\nimport { MarketingHeader } from '@/components/layout/marketing-header';");
       }
       fs.writeFileSync(pPath, content);
    }
  }
});
console.log('DONE');
