'use client';
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search, Plus, LayoutDashboard, Briefcase, Inbox, Calendar,
  Layers, KanbanSquare, CheckSquare, GitBranch, ShieldCheck, FileText,
  BarChart3, Settings, Users, AlertCircle, LogOut, Menu, X, Info, Mail, Shield, FileSignature,
  ChevronDown, User, CreditCard, Key, HelpCircle,
  Building2, GraduationCap, BookOpen, ClipboardCheck, Award, UserCheck,
  BriefcaseBusiness, Target, Bot, QrCode, ClipboardList
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/realtime/notification-bell';
import { MembershipProvider, type MembershipContextValue } from '@/lib/permissions/context';
import { OrgSwitcher } from '@/components/dashboard/org-switcher';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { GlobalAiHub } from '@/components/ai/global-ai-hub';
import { OfflineIndicator } from '@/components/offline/offline-indicator';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { resolveDashboardPersona } from '@/lib/auth/dashboard-persona';

interface ShellProps {
  children: React.ReactNode;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  membership: MembershipContextValue;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_OWNER', 'ORG_ADMIN'];

export function DashboardShell({ children, displayName, initials, avatarUrl, membership }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const tNav = useTranslations('Nav');
  const tShell = useTranslations('Shell');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const persona = resolveDashboardPersona(membership.roles);

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

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [demoAlertVisible, setDemoAlertVisible] = useState(false);
  useEffect(() => {
    const onDemoAlert = () => {
      setDemoAlertVisible(true);
      setTimeout(() => setDemoAlertVisible(false), 4000);
    };
    window.addEventListener('demo-alert', onDemoAlert);
    return () => window.removeEventListener('demo-alert', onDemoAlert);
  }, []);

  // `roles` array for each item defines which personas can see it.
  // Group titles (Main_SYS, OPS_MGT, ...) are deliberately styled system
  // labels — matching this app's terminal/monospace design language
  // throughout (see e.g. app/ai/page.tsx's "PLATFORM_OVERVIEW") — not
  // natural-language prose, so they're intentionally left untranslated.
  const navGroups = [
    { title: 'Main_SYS', items: [
      { name: tNav('overview'), href: '/dashboard', icon: LayoutDashboard },
      { name: tNav('myWork'), href: '/dashboard/my-work', icon: Briefcase },
      { name: tNav('inbox'), href: '/dashboard/inbox', icon: Inbox },
      { name: tNav('calendar'), href: '/dashboard/calendar', icon: Calendar },
    ]},
    { title: 'OPS_MGT', items: [
      { name: tNav('projects'), href: '/dashboard/projects', icon: Layers, roles: ['ADMIN'] },
      { name: tNav('sprints'), href: '/dashboard/sprints', icon: KanbanSquare, roles: ['ADMIN'] },
      { name: tNav('tasks'), href: '/dashboard/tasks', icon: CheckSquare, roles: ['ADMIN'] },
    ]},
    { title: 'ENG_CORE', items: [
      { name: tNav('repositories'), href: '/dashboard/repositories', icon: GitBranch, roles: ['ADMIN'] },
      { name: tNav('qaSecurity'), href: '/dashboard/qa-security', icon: ShieldCheck, roles: ['ADMIN'] },
      { name: tNav('incidents'), href: '/dashboard/incidents', icon: AlertCircle, roles: ['ADMIN'] },
    ]},
    { title: 'DATA_KNOWLEDGE', items: [
      { name: tNav('documents'), href: '/dashboard/documents', icon: FileText, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: tNav('analytics'), href: '/dashboard/analytics', icon: BarChart3, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'EMPLOYER'] },
    ]},
    { title: 'Training_ERP', items: [
      { name: tNav('institutions'), href: '/dashboard/institutions', icon: Building2, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: tNav('programmes'), href: '/dashboard/programmes', icon: GraduationCap, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: tNav('batches'), href: '/dashboard/batches', icon: Users, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER'] },
      { name: tNav('trainees'), href: '/dashboard/trainees', icon: UserCheck, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER'] },
      { name: tNav('trainers'), href: '/dashboard/trainers', icon: User, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: tNav('attendance'), href: '/dashboard/attendance', icon: QrCode, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: tNav('digitalId'), href: '/dashboard/id-card', icon: ShieldCheck, roles: ['TRAINEE'] },
    ]},
    { title: 'Learning_LMS', items: [
      { name: tNav('courses'), href: '/dashboard/courses', icon: BookOpen, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: tNav('assessments'), href: '/dashboard/assessments', icon: ClipboardCheck, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: tNav('certificates'), href: '/dashboard/certificates', icon: Award, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: tNav('skillPassport'), href: '/dashboard/skill-passport', icon: Target, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINEE', 'EMPLOYER'] },
    ]},
    { title: 'Employment', items: [
      { name: tNav('employers'), href: '/dashboard/employers', icon: BriefcaseBusiness, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: tNav('jobs'), href: '/dashboard/jobs', icon: Briefcase, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINEE', 'EMPLOYER'] },
      { name: tNav('applications'), href: '/dashboard/applications', icon: ClipboardList, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'EMPLOYER'] },
    ]},
    { title: 'Cooperative_AI', items: [
      { name: tNav('careerAi'), href: '/dashboard/career-ai', icon: Bot },
    ]},
    { title: 'Admin_Level', items: [
      { name: tNav('teams'), href: '/dashboard/teams', icon: Users, roles: ['ADMIN'] },
      { name: tNav('settings'), href: '/dashboard/settings', icon: Settings, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'EMPLOYER'] },
    ]},
  ].map((g) => ({
    ...g, 
    items: g.items.filter((it) => {
      if (!('roles' in it)) return true; // Available to everyone
      return (it as any).roles.includes(persona) || persona === 'ADMIN';
    })
  }))
  .filter((g) => g.items.length > 0);

  // Flat, permission-filtered destinations for the ⌘K palette (same source of truth as the sidebar).
  const paletteNavItems = navGroups.flatMap((g) => g.items.map((it) => ({ name: it.name, href: it.href, icon: it.icon })));

  // A JSX element (not a component declared during render) so React doesn't
  // remount it each render; reused in both the desktop and mobile sidebars.
  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 text-foreground shrink-0">
        <Link href="/" className="font-bold text-sm tracking-tight flex items-center gap-3">
          <Logo width={28} height={28} />
          <span className="uppercase tracking-widest text-xs mt-1">CoopSetu</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-2 space-y-8 scrollbar-thin">
        {navGroups.map((group, i) => (
          <div key={i}>
            <div className="text-xs font-semibold mb-2 px-4 text-muted-foreground">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item, j) => {
                const active = pathname === item.href;
                
                if (item.name === 'Settings' && membership.isDemo) {
                  return (
                    <button key={j} onClick={() => window.dispatchEvent(new CustomEvent('demo-alert'))}
                      className={`w-full flex items-center justify-start text-left gap-3 px-4 py-2 text-sm font-medium transition-colors rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground`}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                }

                return (
                  <Link key={j} href={item.href} prefetch={false}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                      active
                        ? 'bg-surface-elevated text-foreground'
                        : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
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
        <OrgSwitcher />
      </div>
    </>
  );

  return (
    <MembershipProvider value={membership}>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={paletteNavItems}
        canViewTasks={ADMIN_ROLES.some(r => membership.roles.includes(r)) || membership.permissions.includes('task:view')}
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
          <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 sm:px-8 flex-shrink-0 transition-colors duration-200 z-40">
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
                className="relative w-full max-w-sm hidden md:flex items-center h-9 pl-10 pr-4 text-xs font-mono uppercase tracking-widest bg-surface-hover border border-border rounded hover:border-foreground transition-all text-muted-foreground">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left">{tShell('searchPlaceholder')}</span>
                <kbd className="text-[10px] border border-border px-1.5 py-0.5">CTRL+K</kbd>
              </button>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <LanguageSwitcher />
              <OfflineIndicator />
              <GlobalAiHub />

              <div className="hidden sm:block w-px h-5 bg-border/60 mx-1" />

              {/* Profile Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="group flex items-center gap-2 py-1 transition-all duration-200 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-accent/20 overflow-hidden">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials.charAt(0)
                    )}
                  </span>
                  <span className="hidden sm:block truncate max-w-[80px]">
                    {displayName.split(' ')[0]}
                  </span>
                  <ChevronDown className={`w-3 h-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-background border border-border rounded-lg shadow-2xl z-[90] overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-xs font-mono uppercase tracking-widest text-foreground truncate">{displayName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">{tShell('workspace')}</p>
                      </div>
                      <div className="p-1 flex flex-col gap-0.5">
                        {(ADMIN_ROLES.some(r => membership.roles.includes(r)) || membership.permissions.includes('task:create')) && (
                          <button
                            onClick={() => { setProfileDropdownOpen(false); router.push('/dashboard/tasks'); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> {tShell('initTask')}
                          </button>
                        )}
                        <button
                          onClick={() => { setProfileDropdownOpen(false); router.push('/dashboard'); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5" /> {tShell('dashboard')}
                        </button>
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            if (membership.isDemo) window.dispatchEvent(new CustomEvent('demo-alert'));
                            else router.push('/dashboard/settings?tab=profile');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                        >
                          <User className="w-3.5 h-3.5" /> {tShell('profile')}
                        </button>
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            if (membership.isDemo) window.dispatchEvent(new CustomEvent('demo-alert'));
                            else router.push('/dashboard/settings?tab=org');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" /> {tShell('settings')}
                        </button>
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            if (membership.isDemo) window.dispatchEvent(new CustomEvent('demo-alert'));
                            else router.push('/dashboard/settings?tab=billing');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> {tShell('billing')}
                        </button>
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            if (membership.isDemo) window.dispatchEvent(new CustomEvent('demo-alert'));
                            else router.push('/dashboard/repositories');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5" /> {tShell('repository')}
                        </button>
                      </div>
                      <div className="border-t border-border p-1 flex flex-col gap-0.5">
                        <button
                          onClick={() => { setProfileDropdownOpen(false); router.push('/help'); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                        >
                          <HelpCircle className="w-3.5 h-3.5" /> {tShell('helpAndDocs')}
                        </button>
                      </div>
                      <div className="border-t border-border p-1 flex flex-col gap-0.5">
                        <form action="/auth/signout" method="post">
                          <button
                            type="submit"
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-surface-hover rounded-md transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" /> {tShell('signOut')}
                          </button>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          <NotificationBell />

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
        
        <AnimatePresence>
          {demoAlertVisible && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-background border border-border shadow-2xl px-6 py-4 min-w-[320px] rounded border-l-4 border-l-red-500"
            >
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold uppercase tracking-widest font-mono text-foreground">{tShell('demoLimitationTitle')}</p>
                <p className="text-xs text-muted-foreground mt-1">{tShell('demoLimitationBody')}</p>
              </div>
              <button onClick={() => setDemoAlertVisible(false)} className="p-1 hover:bg-surface-hover text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MembershipProvider>
  );
}
