'use client';
import { useState, useEffect } from 'react';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search, Plus, LayoutDashboard, Briefcase, Inbox, Calendar,
  Layers, KanbanSquare, CheckSquare, GitBranch, ShieldCheck, FileText,
  BarChart3, Settings, Users, AlertCircle, LogOut, Menu, X, Info, Mail, Shield, FileSignature
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/realtime/notification-bell';
import { MembershipProvider, type MembershipContextValue } from '@/lib/permissions/context';
import { OrgSwitcher } from '@/components/dashboard/org-switcher';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { GlobalAiHub } from '@/components/ai/global-ai-hub';

interface ShellProps {
  children: React.ReactNode;
  displayName: string;
  initials: string;
  membership: MembershipContextValue;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_OWNER', 'ORG_ADMIN'];

export function DashboardShell({ children, displayName, initials, membership }: ShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const perms = membership.permissions;
  const isAdmin = membership.roles.some((r) => ADMIN_ROLES.includes(r));
  const can = (p?: string) => !p || isAdmin || perms.includes(p);

  // Close the mobile menu on route change. Done during render (comparing to the
  // previous pathname) rather than in an effect to avoid a cascading re-render.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsMobileMenuOpen(false);
  }

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Global ⌘K / Ctrl+K toggles the command palette from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // `perm` gates visibility of each nav item (admins see all).
  const navGroups = [
    { title: 'Main_SYS', items: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'My Work', href: '/dashboard/my-work', icon: Briefcase },
      { name: 'Inbox', href: '/dashboard/inbox', icon: Inbox },
      { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
    ]},
    { title: 'Ops_MGT', items: [
      { name: 'Projects', href: '/dashboard/projects', icon: Layers, perm: 'project:view' },
      { name: 'Sprints', href: '/dashboard/sprints', icon: KanbanSquare, perm: 'sprint:view' },
      { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare, perm: 'task:view' },
    ]},
    { title: 'Eng_Core', items: [
      { name: 'Repositories', href: '/dashboard/repositories', icon: GitBranch, perm: 'integration:view' },
      { name: 'QA & Security', href: '/dashboard/qa-security', icon: ShieldCheck, perm: 'qa:view' },
      { name: 'Incidents', href: '/dashboard/incidents', icon: AlertCircle },
    ]},
    { title: 'Data_Knowledge', items: [
      { name: 'Documents', href: '/dashboard/documents', icon: FileText, perm: 'document:view' },
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, perm: 'analytics:view' },
    ]},
    { title: 'Admin_Level', items: [
      { name: 'Teams', href: '/dashboard/teams', icon: Users, perm: 'team:view' },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ]},
    { title: 'Legal & Info', items: [
      { name: 'About', href: '/dashboard/about', icon: Info },
      { name: 'Contact', href: '/dashboard/contact', icon: Mail },
      { name: 'Privacy', href: '/dashboard/privacy', icon: Shield },
      { name: 'Terms', href: '/dashboard/terms', icon: FileSignature },
    ]},
    { title: 'Legal & Info', items: [
      { name: 'About', href: '/dashboard/about', icon: Info },
      { name: 'Contact', href: '/dashboard/contact', icon: Mail },
      { name: 'Privacy', href: '/dashboard/privacy', icon: Shield },
      { name: 'Terms', href: '/dashboard/terms', icon: FileSignature },
    ]},
  ].map((g) => ({ ...g, items: g.items.filter((it) => can((it as { perm?: string }).perm)) }))
   .filter((g) => g.items.length > 0);

  // Flat, permission-filtered destinations for the ⌘K palette (same source of truth as the sidebar).
  const paletteNavItems = navGroups.flatMap((g) => g.items.map((it) => ({ name: it.name, href: it.href, icon: it.icon })));

  // A JSX element (not a component declared during render) so React doesn't
  // remount it each render; reused in both the desktop and mobile sidebars.
  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-border text-foreground shrink-0">
        <Link href="/" className="font-bold text-sm tracking-tight flex items-center gap-3">
          <Logo width={24} height={24} />
          <span className="uppercase tracking-widest text-xs">HANDOFF</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin">
        {navGroups.map((group, i) => (
          <div key={i}>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-3 px-2 text-muted-foreground">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item, j) => {
                const active = pathname === item.href;
                return (
                  <Link key={j} href={item.href} prefetch={false}
                    className={`flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
                      active
                        ? 'bg-foreground text-background font-bold border border-foreground'
                        : 'hover:bg-surface-hover text-muted-foreground hover:text-foreground border border-transparent'
                    }`}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-surface-hover shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-background border border-border flex items-center justify-center text-foreground font-mono text-xs font-bold rounded-none shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-foreground font-bold uppercase tracking-widest truncate">{displayName}</div>
            <div className="mt-1"><OrgSwitcher /></div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" title="Sign out"
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground border border-transparent hover:border-border shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <MembershipProvider value={membership}>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={paletteNavItems}
        canViewTasks={can('task:view')}
      />
      <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground transition-colors duration-200 font-sans selection:bg-foreground selection:text-background">
        
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 bg-background text-muted-foreground flex-col flex-shrink-0 border-r border-border transition-colors duration-200 z-20">
          {sidebarContent}
        </aside>

        {/* Mobile Drawer Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <aside data-testid="mobile-drawer" className="relative w-[85%] max-w-sm h-full bg-background flex flex-col border-r border-border shadow-2xl animate-in slide-in-from-left-8 duration-300">
              <button 
                data-testid="mobile-menu-close"
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground bg-surface-hover rounded-full z-50"
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 sm:px-8 flex-shrink-0 transition-colors duration-200 z-10">
            <div className="flex items-center gap-3 sm:gap-4 flex-1">
              {/* Hamburger Menu for Mobile */}
              <button 
                data-testid="mobile-menu-trigger"
                className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground focus:outline-none"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command palette"
                className="relative w-full max-w-sm hidden md:flex items-center h-9 pl-10 pr-4 text-xs font-mono uppercase tracking-widest bg-surface-hover border border-border rounded-none hover:border-foreground transition-all text-muted-foreground">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left">Search query...</span>
                <kbd className="text-[10px] border border-border px-1.5 py-0.5">CTRL+K</kbd>
              </button>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <GlobalAiHub />
              <div className="hidden sm:block w-px h-5 bg-border mx-1 sm:mx-2" />
              {can('task:create') && (
                <Link href="/dashboard/tasks">
                  <Button data-testid="init-task-button" size="sm" className="h-9 px-3 sm:px-6 gap-2 bg-foreground text-background text-xs font-mono uppercase tracking-widest hover:bg-foreground/90 rounded-none">
                    <Plus className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Init_Task</span>
                  </Button>
                </Link>
              )}
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-background transition-colors duration-200 relative">
            <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
              <div className="h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            </div>
            {/* Responsive padding */}
            <div className="mx-auto w-full p-4 sm:p-6 lg:p-8 relative z-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </MembershipProvider>
  );
}
