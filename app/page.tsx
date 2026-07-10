'use client';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { WORLD_LAND_PATH } from '@/lib/world-map-path';
import { EnterpriseCapabilities } from '@/components/marketing/enterprise-capabilities';
import { GlobalScalePanel } from '@/components/sections/global-scale-panel';
import { RealTimeSyncPanel } from '@/components/sections/real-time-sync-panel';
import { DataIntegrityPanel } from '@/components/sections/data-integrity-panel';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import BlurText from '@/components/ui/blur-text';
import { createClient } from '@/lib/supabase/client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import SplitText from '@/components/ui/split-text';
import { PublicFooter } from '@/components/layout/public-footer';
import { ArrowRight, BarChart3, CheckCircle2, GitPullRequest, Layers, Lock, Shield, Terminal, Zap, Activity, Cpu, Loader2, ChevronDown, LogOut, Settings, User, LayoutDashboard } from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';

type SprintBoardCard = {
  id: string;
  title: string;
  tag: string;
  who: string;
  prio?: boolean;
  progress?: number;
  done?: boolean;
};

type SprintBoardColumn = {
  title: string;
  count: number;
  accent: boolean;
  cards: SprintBoardCard[];
};

export default function LandingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navType, setNavType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedPanel, setExpandedPanel] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkDemoAndLogout = () => {
      setIsNavigating(false);
      const isDemo = document.cookie.includes('handoff_demo_session=true');
      if (isDemo) {
        fetch('/api/v1/demo/exit', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).then(() => {
          setIsLoggedIn(false);
          setUserName(null);
          router.refresh();
        });
      } else {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) {
            setIsLoggedIn(true);
            supabase.from('profiles').select('full_name, email').eq('id', data.user.id).single().then(({ data: profile }) => {
              const name = profile?.full_name || profile?.email || data.user?.email || 'User';
              setUserName(name);
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

  // Close dropdown on outside click
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
    router.refresh();
  };

  const toggleArchPanel = (index: number | null) => {
    setExpandedPanel(prev => prev === index ? null : index);
  };

  const handleNavigate = (path: string, type: string) => {
    setIsNavigating(true);
    setNavType(type);
    router.push(path);
  };

  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const yDashboard = useTransform(scrollYProgress, [0, 1], [0, -100]);



  // Live sprint board
  const board: SprintBoardColumn[] = [
    {
      title: 'Backlog', count: 8, accent: false,
      cards: [
        { id: 'DEV-221', title: 'Webhook retry logic', tag: 'Core', who: 'JK' },
        { id: 'DEV-218', title: 'Rate limit tuning', tag: 'API', who: 'ML' },
      ],
    },
    {
      title: 'In Progress', count: 3, accent: true,
      cards: [
        { id: 'DEV-204', title: 'Realtime sync engine', tag: 'Infra', who: 'AR', prio: true, progress: 64 },
        { id: 'DEV-209', title: 'Audit log export', tag: 'Sec', who: 'TS', progress: 30 },
      ],
    },
    {
      title: 'Shipped', count: 12, accent: false,
      cards: [
        { id: 'DEV-201', title: 'Dashboard v2', tag: 'UI', who: 'PS', done: true },
        { id: 'DEV-198', title: 'SSO provider support', tag: 'Auth', who: 'DV', done: true },
      ],
    },
  ];

  // Overlay analytics widget — tabbed chart
  const charts = [
    { label: 'Velocity', value: '142', unit: 'pts', delta: '+12%', up: true, data: [40, 55, 48, 62, 58, 72, 68, 85, 90] },
    { label: 'Burndown', value: '38', unit: 'left', delta: '-24%', up: false, data: [95, 88, 80, 70, 64, 55, 48, 42, 38] },
    { label: 'Coverage', value: '94', unit: '%', delta: '+3%', up: true, data: [70, 72, 75, 78, 80, 84, 88, 91, 94] },
  ];
  const chart = charts[activeTab];
  const CW = 260, CH = 96, CPAD = 12;
  const cMax = Math.max(...chart.data), cMin = Math.min(...chart.data), cRange = cMax - cMin || 1;
  const cPts = chart.data.map((v, i) => {
    const x = (i / (chart.data.length - 1)) * CW;
    const yv = CPAD + (1 - (v - cMin) / cRange) * (CH - 2 * CPAD);
    return [x, yv] as const;
  });
  const cLine = cPts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const cArea = `M0,${CH} ${cPts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${CW},${CH} Z`;

  return (
    <div className="dark min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-200">
      {/* Sharp minimal header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl"
      >
        <div className="w-full px-6 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Link href="/" className="font-bold text-lg tracking-tight flex items-center gap-3">
              <Logo width={24} height={24} />
              <span className="uppercase tracking-widest text-xs">HANDOFF</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              <Link href="/product" className="hover:text-foreground transition-colors">Product</Link>
              <Link href="/solutions" className="hover:text-foreground transition-colors">Solutions</Link>
              <Link href="/ai" className="hover:text-foreground transition-colors">AI</Link>
              <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="/enterprise" className="hover:text-foreground transition-colors">Enterprise</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
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
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-accent/20">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </span>
                  <span className="hidden md:block truncate max-w-[96px]">
                    {userName ? userName.split(' ')[0] : 'User'}
                  </span>
                  <ChevronDown className={`w-3 h-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} />
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
      </motion.header>

      <main className="flex-1 flex flex-col w-full">
        {/* Futuristic Hero Section */}
        <section className="relative min-h-screen flex flex-col justify-center pt-28 pb-20 md:pt-24 md:pb-16 px-6 md:px-12 border-b border-border overflow-hidden">
          {/* Animated accent aurora — sits behind the board / analytics cluster */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.08, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 right-0 -translate-y-1/2 w-[90vw] max-w-[650px] aspect-square rounded-full pointer-events-none z-0 blur-[130px] bg-accent"
          />

          {/* Abstract Geometry */}
          <div className="absolute top-0 right-0 -mr-[10vw] -mt-[10vw] w-[80vw] max-w-[800px] aspect-square border border-border rounded/40 rounded-full opacity-20 pointer-events-none z-0" />
          <div className="absolute top-0 right-0 -mr-[5vw] -mt-[5vw] w-[60vw] max-w-[600px] aspect-square border border-border rounded/40 rounded-full opacity-30 pointer-events-none z-0" />
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 right-0 -mr-[8vw] -mt-[8vw] w-[70vw] max-w-[700px] aspect-square border border-accent/30 border-dashed rounded-full opacity-40 pointer-events-none z-0"
          />

          <div className="relative z-10 w-full flex flex-col md:flex-row items-center gap-16 md:gap-20">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1"
            >
              {/* Status chips */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2.5 border border-border rounded bg-surface/40 backdrop-blur-sm px-3 py-1.5">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inline-flex w-full h-full bg-accent animate-ping opacity-75" />
                    <span className="relative inline-flex w-2 h-2 bg-accent" />
                  </span>
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">System Online // v2.0</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 border border-border rounded bg-surface/40 backdrop-blur-sm px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Cpu className="w-3 h-3 text-accent" />
                  Build 2.0.1
                </div>
              </div>

              <h1 className="text-5xl md:text-7xl lg:text-[96px] font-bold tracking-tighter mb-6 leading-[0.9] uppercase relative">
                <div className="flex flex-col text-left">
                  <SplitText text="Ship." className="block" textAlign="left" delay={120} splitType="chars" />
                  <SplitText text="Control." className="block text-muted-foreground" textAlign="left" delay={120} splitType="chars" />
                  <div className="flex items-center">
                    <SplitText text="Dominate." className="block" textAlign="left" delay={120} splitType="chars" />
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="inline-block w-3 h-12 md:w-5 md:h-20 bg-accent ml-4 align-baseline translate-y-1"
                    />
                  </div>
                </div>
                <div className="absolute -left-8 top-4 bottom-4 w-1 bg-gradient-to-b from-accent via-foreground/20 to-transparent hidden md:block" />
              </h1>

              <div className="mt-8 border-t border-border pt-8 relative">
                <div className="absolute -top-[1px] left-0 w-12 h-[1px] bg-accent" />
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-light mb-8 max-w-xl">
                  Handoff brings projects, sprints, teams, releases, documentation, compliance, and AI intelligence into one hyper-structured, high-performance workspace.
                </p>
                <div className="flex flex-col sm:flex-row items-start justify-start gap-6">
                  <Button
                    size="lg"
                    onClick={() => handleNavigate('/dashboard', 'init')}
                    disabled={isNavigating}
                    className="h-14 px-8 text-sm font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 group w-52"
                  >
                    {isNavigating && navType === 'init' ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> BOOTING...</span>
                    ) : (
                      <>Initialize <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </Button>
                  <Link href="#explore">
                    <Button size="lg" variant="outline" className="h-14 px-8 text-sm font-mono uppercase tracking-widest border-black text-foreground hover:bg-surface-hover">
                      Explore Architecture
                    </Button>
                  </Link>
                </div>

                {/* Trust strip */}
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {['500+ Teams', '24 Regions', 'SOC 2 Type II', '99.9% Uptime'].map((item, i) => (
                    <div key={item} className="flex items-center gap-6">
                      {i > 0 && <span className="w-1 h-1 bg-accent" />}
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Live Sprint Board */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md md:ml-auto relative z-10"
            >
              {/* Floating accent ticket */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: [0, -8, 0] }}
                transition={{ opacity: { delay: 1.4, duration: 0.6 }, y: { delay: 1.4, duration: 4, repeat: Infinity, ease: "easeInOut" } }}
                className="absolute -top-5 -right-3 z-20 hidden lg:flex items-center gap-2 border border-accent bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground shadow-xl"
              >
                <Zap className="w-3 h-3 text-accent" />
                +12% Velocity
              </motion.div>

              <div className="bg-background border border-black rounded backdrop-blur-sm relative overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 h-12 border-b border-black bg-background">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
                    <Layers className="w-3.5 h-3.5 text-accent" />
                    <span className="text-foreground font-bold">Sprint 24</span>
                    <span className="text-muted-foreground">{'// Board'}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span className="w-1.5 h-1.5 bg-accent animate-pulse" />
                    142 pts
                  </div>
                </div>

                {/* Columns */}
                <div className="grid grid-cols-3 gap-px bg-border">
                  {board.map((col, ci) => (
                    <div key={col.title} className="bg-background p-3 min-h-[340px] flex flex-col gap-3">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 ${col.accent ? 'bg-accent' : 'bg-border-strong'}`} />
                          {col.title}
                        </span>
                        <span>{col.count}</span>
                      </div>

                      {col.cards.map((card, idx) => (
                        <motion.div
                          key={card.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.6 + ci * 0.15 + idx * 0.1, ease: "easeOut" }}
                          className={`border bg-background p-3 transition-colors hover:border-foreground ${card.prio ? 'border-accent' : 'border-border'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{card.id}</span>
                            <span className={`w-1.5 h-1.5 ${card.prio ? 'bg-accent' : card.done ? 'bg-foreground' : 'bg-border-strong'}`} />
                          </div>
                          <div className="text-xs text-foreground leading-snug mb-3">{card.title}</div>

                          {typeof card.progress === 'number' && (
                            <div className="w-full h-0.5 bg-border mb-3 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${card.progress}%` }}
                                transition={{ duration: 1, delay: 1 + idx * 0.2, ease: "easeOut" }}
                                className="h-full bg-accent"
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-widest border border-border rounded px-1.5 py-0.5 text-muted-foreground">{card.tag}</span>
                            {card.done ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                            ) : (
                              <span className="w-5 h-5 border border-border rounded flex items-center justify-center font-mono text-[8px] uppercase tracking-wider text-muted-foreground">{card.who}</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Footer — sprint progress */}
                <div className="border-t border-border px-5 py-4 flex items-center gap-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Sprint Progress</div>
                  <div className="flex-1 h-1 bg-border overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '68%' }}
                      transition={{ duration: 1.4, delay: 1.4, ease: "easeOut" }}
                      className="h-full bg-accent"
                    />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-foreground shrink-0">68%</span>
                </div>
              </div>

              {/* Overlapping analytics widget — tabbed chart */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -left-16 -bottom-16 z-30 w-96 hidden lg:block border border-black rounded bg-background/90 backdrop-blur-md shadow-2xl"
              >
                {/* Widget header */}
                <div className="flex items-center justify-between px-5 h-12 border-b border-black">
                  <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest text-foreground">
                    <BarChart3 className="w-4 h-4 text-accent" />
                    Analytics
                  </div>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span className="w-1.5 h-1.5 bg-accent animate-pulse" /> Realtime
                  </span>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-black">
                  {charts.map((c, i) => (
                    <button
                      key={c.label}
                      onClick={() => setActiveTab(i)}
                      className={`flex-1 py-3.5 font-mono text-[11px] uppercase tracking-widest transition-colors relative ${activeTab === i ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {c.label}
                      {activeTab === i && (
                        <motion.span layoutId="tabUnderline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-end justify-between mb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold tracking-tighter text-foreground">{chart.value}</span>
                      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{chart.unit}</span>
                    </div>
                    <span className={`font-mono text-xs uppercase tracking-widest ${chart.up ? 'text-accent' : 'text-muted-foreground'}`}>
                      {chart.up ? '▲' : '▼'} {chart.delta}
                    </span>
                  </div>

                  <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="w-full h-36 overflow-visible">
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* gridlines */}
                    {[0.25, 0.5, 0.75].map((g) => (
                      <line key={g} x1="0" y1={CH * g} x2={CW} y2={CH * g} stroke="var(--border)" strokeWidth="1" />
                    ))}
                    <motion.path
                      key={`area-${activeTab}`}
                      d={cArea}
                      fill="url(#chartFill)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                    <motion.path
                      key={`line-${activeTab}`}
                      d={cLine}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </svg>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-3"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Scroll Down</span>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </motion.div>
        </section>

        {/* Dashboard Preview Interface */}
        <section className="px-6 md:px-12 py-32 bg-background border-b border-border relative perspective-[2000px] overflow-hidden">
          {/* Ambient Purple Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-[600px] h-[60vw] max-h-[400px] md:max-w-[1000px] md:max-h-[600px] rounded-[100%] blur-[120px] bg-accent/15 pointer-events-none z-0" />

          <div className="container mx-auto max-w-7xl relative z-10">
            <motion.div
              style={{ y: yDashboard }}
              initial={{ opacity: 0, rotateX: 10, y: 100 }}
              whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="border border-border rounded bg-background shadow-[0_0_80px_-20px_rgba(124,92,252,0.15)] relative transition-transform overflow-hidden"
            >
              {/* Subtle Purple Gradient Top Border */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent z-20 opacity-70" />

              {/* UI Frame Top */}
              <div className="w-full h-10 bg-surface-elevated border-b border-border flex items-center justify-between px-4 relative z-10">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-border-strong rounded" />
                  <div className="w-2 h-2 bg-border-strong rounded" />
                  <div className="w-2 h-2 bg-border-strong rounded" />
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Handoff_Workspace_Alpha
                </div>
              </div>

              {/* Simulated App Content */}
              <div className="flex flex-col md:flex-row h-auto min-h-[600px] lg:min-h-[700px]">
                {/* Fake Sidebar */}
                <div className="w-64 border-r border-border bg-background p-6 hidden md:flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-10 border-b border-border pb-6">
                      <Logo width={20} height={20} />
                      <span className="font-mono text-xs uppercase tracking-widest font-bold">Apex_Fin</span>
                    </div>
                    <div className="space-y-8">
                      <div>
                        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Operations</div>
                        <div className="space-y-2">
                          {['Projects', 'Sprints', 'Tasks'].map(i => (
                            <div key={i} className="text-sm font-mono uppercase tracking-wider py-2 px-3 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded cursor-pointer transition-colors flex items-center justify-between group">
                              {i}
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Engineering</div>
                        <div className="space-y-2">
                          {['Repositories', 'Releases', 'Incidents'].map(i => (
                            <div key={i} className="text-sm font-mono uppercase tracking-wider py-2 px-3 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded cursor-pointer transition-colors flex items-center justify-between group">
                              {i}
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fake Main Area */}
                <div className="flex-1 bg-background p-8 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Shield className="w-64 h-64" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-end mb-12 border-b border-border pb-6">
                      <div>
                        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Module_01</div>
                        <h2 className="text-3xl font-bold text-foreground uppercase tracking-tighter">Command Center</h2>
                      </div>
                      <div className="flex gap-3">
                        <div className="h-8 w-32 border border-border rounded bg-background rounded flex items-center px-3">
                          <div className="w-2 h-2 bg-foreground mr-2 animate-pulse" />
                          <span className="font-mono text-[10px] uppercase">Live Sync</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                      {[
                        { label: 'Active Projects', value: '24', sub: 'Optimal', icon: <Layers className="w-4 h-4 text-foreground" /> },
                        { label: 'Sprint Velocity', value: '142', sub: '+12% WoW', icon: <Zap className="w-4 h-4 text-foreground" /> },
                        { label: 'Pending Approvals', value: '07', sub: 'Action Req', icon: <CheckCircle2 className="w-4 h-4 text-foreground" /> }
                      ].map((stat, i) => (
                        <div key={i} className="bg-background p-6 border border-border rounded flex flex-col justify-between h-40 hover:border-foreground transition-colors group">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-mono text-[10px] uppercase tracking-widest">{stat.label}</span>
                            <div className="p-2 border border-border rounded group-hover:border-foreground transition-colors">{stat.icon}</div>
                          </div>
                          <div>
                            <div className="text-4xl font-bold text-foreground mb-1 tracking-tighter">{stat.value}</div>
                            <div className="font-mono text-[10px] uppercase text-muted-foreground">{stat.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 bg-background border border-border rounded p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-8">
                          <h3 className="font-mono text-xs uppercase tracking-widest text-foreground">Velocity Trend</h3>
                          <div className="flex gap-2">
                            <div className="w-2 h-2 bg-foreground" />
                            <div className="w-2 h-2 bg-border" />
                            <div className="w-2 h-2 bg-border" />
                          </div>
                        </div>

                        {/* Fake line chart */}
                        <div className="relative h-48 w-full border-b border-l border-border flex items-end justify-between px-2 pb-2 gap-2">
                          {[30, 45, 25, 60, 40, 75, 50, 90, 65, 80, 55, 100].map((h, i) => (
                            <div key={i} className="relative w-full flex justify-center group/chart">
                              <motion.div
                                initial={{ height: 0 }}
                                whileInView={{ height: `${h}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 1, delay: i * 0.05 }}
                                className="w-full bg-border group-hover/chart:bg-foreground transition-colors absolute bottom-0"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-4 font-mono text-[10px] text-muted-foreground">
                          <span>Sprint 10</span>
                          <span>Sprint 21</span>
                        </div>
                      </div>

                      <div className="bg-background border border-border rounded p-6 relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
                        <h3 className="font-mono text-xs uppercase tracking-widest mb-6 flex items-center gap-3 text-foreground">
                          <Terminal className="w-4 h-4 text-accent" />
                          AI Feed
                        </h3>
                        <div className="space-y-4 font-mono text-xs flex-1">
                          <div className="p-3 border border-border rounded bg-surface-hover text-foreground">
                            <span className="text-accent mr-2">{'>'}</span>
                            WARN: Mobile team over capacity.
                          </div>
                          <div className="p-3 border border-border rounded text-muted-foreground">
                            <span className="mr-2">{'>'}</span>
                            INFO: 2 PRs blocked.
                          </div>
                          <div className="p-3 border border-border rounded text-muted-foreground">
                            <span className="mr-2">{'>'}</span>
                            INFO: Deploy successful.
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground opacity-50 mt-4 text-xs font-mono">
                          <div className="w-2 h-3 bg-foreground animate-pulse" /> Ready
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Infinite Marquee */}
        <section className="section-inverse w-full py-6 border-b border-border bg-foreground text-background overflow-hidden flex items-center whitespace-nowrap">
          <motion.div
            animate={{ x: [0, -1035] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 15 }}
            className="flex items-center gap-12 font-mono text-xs uppercase tracking-widest"
          >
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-12">
                <span>Enterprise Grade</span>
                <div className="w-1.5 h-1.5 bg-background rounded" />
                <span>Zero Compromise</span>
                <div className="w-1.5 h-1.5 bg-background rounded" />
                <span>Absolute Precision</span>
                <div className="w-1.5 h-1.5 bg-background rounded" />
                <span>Maximum Velocity</span>
                <div className="w-1.5 h-1.5 bg-background rounded" />
              </div>
            ))}
          </motion.div>
        </section>

        {/* Features Minimalist Grid */}
        <section className="py-28 md:py-32 bg-background border-b border-border relative overflow-hidden" id="explore">
          <div className="absolute -top-32 right-0 w-[600px] h-[600px] rounded-full blur-[160px] bg-accent/10 pointer-events-none z-0" />

          <div className="container mx-auto px-6 md:px-12 relative z-10">
            {/* Two-column header */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-12"
            >
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6">
                  <span className="w-2 h-2 bg-accent" /> Core Infrastructure // 06 Modules
                </div>
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter uppercase leading-[0.9]">
                  Absolute<br />Precision.
                </h2>
              </div>
              <div className="max-w-sm">
                <p className="text-muted-foreground text-base leading-relaxed mb-6">
                  One platform to plan, ship, secure, and analyze — engineered for teams that can&apos;t afford to slow down.
                </p>
                <Link href="/product" className="inline-flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-foreground border-b border-accent pb-1 group w-fit">
                  Explore all modules <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>

            {/* Social-proof metrics strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-border border border-border rounded mb-3">
              {[
                { v: '10x', l: 'Faster Delivery' },
                { v: '99.9%', l: 'Platform Uptime' },
                { v: '24', l: 'Edge Regions' },
                { v: 'SOC 2', l: 'Type II Certified' },
              ].map((m, i) => (
                <div key={i} className="bg-background p-6 md:p-8 group hover:bg-surface transition-colors">
                  <div className="text-3xl md:text-4xl font-bold tracking-tighter mb-2 group-hover:text-accent transition-colors">{m.v}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{m.l}</div>
                </div>
              ))}
            </div>

            {/* Bento feature grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-border border border-border rounded">
              {/* A — Enterprise Visibility */}
              <div className="md:col-span-2 bg-background p-8 md:p-12 relative overflow-hidden group hover:bg-surface transition-colors duration-500 flex flex-col justify-between min-h-[440px]">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="h-full w-full bg-[radial-gradient(ellipse_at_top_right,var(--accent)_0%,transparent_55%)] opacity-10" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 border border-border rounded flex items-center justify-center bg-background group-hover:border-accent transition-colors">
                      <BarChart3 className="w-5 h-5 text-accent" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Module_01</span>
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold uppercase tracking-tighter mb-4 text-foreground">Enterprise Visibility.</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-md">Track portfolios, programs, and projects across departments with real-time health metrics and dependency mapping.</p>
                </div>

                {/* Visible animated chart */}
                <div className="relative z-10 w-full bg-background border border-border rounded p-6 mt-8">
                  <div className="flex items-center justify-between mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>Portfolio Health</span>
                    <span className="text-accent">+18% QoQ</span>
                  </div>
                  <div className="flex gap-2 md:gap-2.5 items-end h-28">
                    {[45, 70, 40, 85, 55, 95, 60, 80, 50, 90, 65, 100].map((h, i) => (
                      <div key={i} className="flex-1 bg-surface-hover relative overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          viewport={{ once: true, amount: 0.4 }}
                          transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                          className={`absolute bottom-0 w-full ${i % 3 === 0 ? 'bg-accent' : 'bg-foreground'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* B — Agile Delivery */}
              <div className="bg-background p-8 relative overflow-hidden group hover:bg-surface transition-colors duration-500 flex flex-col justify-between min-h-[440px]">
                <div>
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 border border-border rounded flex items-center justify-center group-hover:border-accent transition-colors">
                      <Zap className="w-5 h-5 text-accent" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Module_02</span>
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter mb-4 text-foreground">Agile Delivery.</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">Run sprints, manage backlogs, and track velocity for cross-functional teams.</p>
                </div>
                <div className="space-y-4 mt-8">
                  {[{ l: 'Sprint 24', v: 72 }, { l: 'Backlog', v: 40 }, { l: 'In Review', v: 90 }].map((r, i) => (
                    <div key={i}>
                      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                        <span>{r.l}</span><span className="text-foreground">{r.v}%</span>
                      </div>
                      <div className="h-1.5 bg-surface-hover overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${r.v}%` }}
                          viewport={{ once: true, amount: 0.5 }}
                          transition={{ duration: 1, delay: i * 0.15, ease: "easeOut" }}
                          className="h-full bg-accent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* C — Security Control */}
              <div className="bg-background p-8 relative overflow-hidden group hover:bg-surface transition-colors duration-500 flex flex-col justify-between min-h-[380px]">
                <div>
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 border border-border rounded flex items-center justify-center group-hover:border-accent transition-colors">
                      <Shield className="w-5 h-5 text-accent" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Module_03</span>
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter mb-4 text-foreground">Security Control.</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">Enforce release approvals, manage audit logs, and track security reviews.</p>
                </div>
                <div className="space-y-2 mt-8 font-mono text-[10px] uppercase tracking-widest">
                  {['Release approved', 'Audit log sealed', '2FA enforced'].map((t, i) => (
                    <div key={i} className="flex items-center justify-between border border-border rounded p-2.5 group-hover:border-border-strong transition-colors">
                      <span className="text-muted-foreground flex items-center gap-2"><Lock className="w-3 h-3 text-accent" />{t}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                    </div>
                  ))}
                </div>
              </div>

              {/* D — Live Collaboration */}
              <div className="bg-background p-8 relative overflow-hidden group hover:bg-surface transition-colors duration-500 flex flex-col justify-between min-h-[380px]">
                <div>
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 border border-border rounded flex items-center justify-center group-hover:border-accent transition-colors">
                      <GitPullRequest className="w-5 h-5 text-accent" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Module_04</span>
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter mb-4 text-foreground">Live Collaboration.</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">Reviews, comments, and handoffs that keep every team in perfect sync.</p>
                </div>
                <div className="mt-8 flex items-center justify-between border border-border rounded p-4">
                  <div className="flex -space-x-2">
                    {['AR', 'JK', 'ML', 'PS'].map((a) => (
                      <span key={a} className="w-8 h-8 border border-border rounded bg-surface flex items-center justify-center font-mono text-[9px] uppercase text-foreground">{a}</span>
                    ))}
                    <span className="w-8 h-8 border border-accent bg-accent flex items-center justify-center font-mono text-[9px] text-accent-foreground">+8</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-accent animate-pulse" /> 12 Online
                  </span>
                </div>
              </div>

              {/* E — Native Integrations */}
              <div className="bg-background p-8 relative overflow-hidden group hover:bg-surface transition-colors duration-500 flex flex-col justify-between min-h-[380px]">
                <div>
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 border border-border rounded flex items-center justify-center group-hover:border-accent transition-colors">
                      <Cpu className="w-5 h-5 text-accent" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Module_05</span>
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter mb-4 text-foreground">Native Integrations.</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">Connect your stack — CI, repos, chat, and cloud — in a single click.</p>
                </div>
                <div className="mt-8">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { n: 'GitHub', k: 'GH', on: true },
                      { n: 'Slack', k: 'SL', on: false },
                      { n: 'Jira', k: 'JR', on: false },
                      { n: 'AWS', k: 'AW', on: true },
                      { n: 'Linear', k: 'LN', on: false },
                      { n: 'Docker', k: 'DK', on: false },
                    ].map((it) => (
                      <div key={it.n} className="flex items-center gap-2.5 border border-border rounded p-2.5 group-hover:border-border-strong transition-colors">
                        <span className={`w-7 h-7 shrink-0 flex items-center justify-center font-mono text-[9px] font-bold border ${it.on ? 'border-accent text-accent' : 'border-border text-muted-foreground'}`}>{it.k}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-foreground truncate">{it.n}</span>
                        <span className={`ml-auto w-1.5 h-1.5 shrink-0 ${it.on ? 'bg-accent animate-pulse' : 'bg-border-strong'}`} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <span className="text-accent font-bold">+40</span> more integrations
                  </div>
                </div>
              </div>

              {/* F — AI Intelligence (standout, full width) */}
              <div className="md:col-span-3 bg-foreground text-background p-8 md:p-12 relative overflow-hidden group flex flex-col md:flex-row md:items-center gap-10 justify-between">
                <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 pointer-events-none">
                  <Terminal className="w-[80vw] h-[80vw] max-w-[320px] max-h-[320px]" />
                </div>
                <div className="relative z-10 max-w-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 border border-background/20 flex items-center justify-center">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-background/50">Module_06 // Core</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter mb-4">AI Intelligence.</h3>
                  <p className="text-background/70 text-sm leading-relaxed mb-8 max-w-md">Summarize PRs, generate test cases, and surface delivery bottlenecks automatically — your senior engineer that never sleeps.</p>
                  <Button
                    onClick={() => handleNavigate('/dashboard', 'ai')}
                    disabled={isNavigating}
                    className="h-12 px-8 text-xs font-mono uppercase tracking-widest bg-background text-foreground hover:bg-background/90 rounded group/btn"
                  >
                    See It In Action <ArrowRight className="ml-3 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
                <div className="relative z-10 w-full md:w-96 shrink-0 border border-background/20 bg-background/5 backdrop-blur-sm p-5 font-mono text-xs space-y-3">
                  {[
                    { tag: 'PR #482', msg: 'Summarized · ready to merge' },
                    { tag: 'TESTS', msg: '14 edge cases generated' },
                    { tag: 'RISK', msg: 'Bottleneck flagged in API' },
                  ].map((l) => (
                    <div key={l.tag} className="flex items-center gap-3">
                      <span className="text-accent shrink-0">{'>'}</span>
                      <span className="border border-background/20 px-1.5 py-0.5 text-[10px] uppercase tracking-widest shrink-0">{l.tag}</span>
                      <span className="text-background/70 truncate">{l.msg}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-accent">{'>'}</span>
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-1.5 h-3.5 bg-accent inline-block"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture Grid Section */}
        <section id="explore" className="bg-background text-foreground border-b border-border py-24 px-6 md:px-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,92,252,0.1)_0%,transparent_70%)] pointer-events-none" />
          <div className="container mx-auto max-w-7xl relative z-10">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 relative">
              {/* Overlay Backdrop */}
              <div
                className={`fixed inset-0 bg-background/80 transition-all duration-700 ease-in-out ${expandedPanel !== null ? 'opacity-100 z-40' : 'opacity-0 -z-10 pointer-events-none'
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleArchPanel(null);
                }}
              />

              {/* Panel 1: Data Integrity */}
              <div className="flex-1 min-w-0 relative flex flex-col">
                <div
                  onClick={() => toggleArchPanel(1)}
                  className={`flex-1 relative flex flex-col lg:flex-row bg-surface border transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer h-full ${expandedPanel === 1
                      ? 'w-full lg:w-[calc(200%+2.5rem)] lg:ml-0 z-50 shadow-2xl border-border group hover:border-foreground/30'
                      : expandedPanel === 2
                        ? 'w-full lg:ml-0 z-30 border-border/50 origin-left scale-[0.95] opacity-100'
                        : expandedPanel === 3
                          ? 'w-full lg:ml-0 z-20 border-border/50 origin-left scale-[0.90] opacity-100'
                          : 'w-full lg:ml-0 z-10 border-border/50 group hover:border-foreground/30'
                    }`}
                >
                  {/* Render the new standalone Data Integrity component */}
                  <DataIntegrityPanel expanded={expandedPanel === 1} />

                  {/* Extra Extracted Data */}
                  <div className={`hidden lg:flex flex-col justify-center transition-all duration-[800ms] overflow-hidden bg-muted/40 ${expandedPanel === 1 ? 'w-[calc(50%+1.25rem)] opacity-100 border-l border-border p-12' : 'w-0 opacity-0 border-transparent p-0'
                    }`}>
                    <div className="w-full min-w-[220px]">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-6 whitespace-nowrap">Extraction Complete // 100%</div>
                      <h3 className="text-3xl font-bold mb-6">Cryptographic Ledger</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                        Our proprietary consensus algorithm ensures zero data loss even during severe network partitions. Every byte is checksummed, encrypted at rest using AES-256-GCM, and replicated synchronously.
                      </p>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-2">
                            <span>Validation Node A</span>
                            <span className="text-green-400">SYNCED</span>
                          </div>
                          <div className="w-full h-1 bg-border overflow-hidden"><div className="w-full h-full bg-green-500" /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-2">
                            <span>Validation Node B</span>
                            <span className="text-green-400">SYNCED</span>
                          </div>
                          <div className="w-full h-1 bg-border overflow-hidden"><div className="w-[98%] h-full bg-green-500" /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-2">
                            <span>Failover Node C</span>
                            <span className="text-amber-400">STANDBY</span>
                          </div>
                          <div className="w-full h-1 bg-border overflow-hidden"><div className="w-[45%] h-full bg-amber-500" /></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 2: Global Scale */}
              <div className="flex-1 min-w-0 relative flex flex-col">
                <div
                  onClick={() => toggleArchPanel(2)}
                  className={`flex-1 relative flex flex-col lg:flex-row bg-surface border transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer h-full ${expandedPanel === 2
                      ? 'w-full lg:w-[calc(200%+2.5rem)] lg:-ml-[calc(50%+1.25rem)] z-50 shadow-2xl border-border group hover:border-foreground/30'
                      : expandedPanel === 1
                        ? 'w-full lg:ml-0 z-30 border-border/50 translate-x-[calc(55%+1.25rem)] scale-[0.95] opacity-100'
                        : expandedPanel === 3
                          ? 'w-full lg:ml-0 z-30 border-border/50 -translate-x-[calc(55%+1.25rem)] scale-[0.95] opacity-100'
                          : 'w-full lg:ml-0 z-10 border-border/50 group hover:border-foreground/30'
                    }`}
                >
                  {/* Render the new standalone Global Scale component */}
                  <GlobalScalePanel expanded={expandedPanel === 2} />

                  {/* Extra Extracted Data */}
                  <div className={`hidden lg:flex flex-col justify-center transition-all duration-[800ms] overflow-hidden bg-muted/40 ${expandedPanel === 2 ? 'w-[calc(50%+1.25rem)] opacity-100 border-l border-border p-12' : 'w-0 opacity-0 border-transparent p-0'
                    }`}>
                    <div className="w-full min-w-[220px]">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-6 whitespace-nowrap">Extraction Complete // 100%</div>
                      <h3 className="text-3xl font-bold mb-6">Global Anycast Network</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                        We utilize a globally distributed edge network with smart routing. Our active-active architecture automatically shifts traffic during regional outages without manual intervention.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {['us-east', 'eu-west', 'ap-south', 'sa-east'].map(region => (
                          <div key={region} className="bg-surface border border-border rounded p-4">
                            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Region</div>
                            <div className="text-sm font-bold text-foreground mb-2">{region}</div>
                            <div className="text-[10px] font-mono text-green-500 animate-pulse">Online // 99.999%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 3: Real-Time Sync */}
              <div className="flex-1 min-w-0 relative flex flex-col">
                <div
                  onClick={() => toggleArchPanel(3)}
                  className={`flex-1 relative flex flex-col lg:flex-row bg-surface border transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer h-full ${expandedPanel === 3
                      ? 'w-full lg:w-[calc(200%+2.5rem)] lg:-ml-[calc(100%+2.5rem)] z-50 shadow-2xl border-border group hover:border-foreground/30'
                      : expandedPanel === 2
                        ? 'w-full lg:ml-0 z-20 border-border/50 origin-right scale-[0.95] opacity-100'
                        : expandedPanel === 1
                          ? 'w-full lg:ml-0 z-20 border-border/50 origin-right scale-[0.90] opacity-100'
                          : 'w-full lg:ml-0 z-10 border-border/50 group hover:border-foreground/30'
                    }`}
                >
                  {/* Render the new standalone Real-Time Sync component */}
                  <RealTimeSyncPanel expanded={expandedPanel === 3} />

                  {/* Extra Extracted Data */}
                  <div className={`hidden lg:flex flex-col justify-center transition-all duration-[800ms] overflow-hidden bg-muted/40 ${expandedPanel === 3 ? 'w-[calc(50%+1.25rem)] opacity-100 border-l border-border p-12' : 'w-0 opacity-0 border-transparent p-0'
                    }`}>
                    <div className="w-full min-w-[220px]">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-6 whitespace-nowrap">Extraction Complete // 100%</div>
                      <h3 className="text-3xl font-bold mb-6">CRDT Sync Engine</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                        Our custom Conflict-Free Replicated Data Type engine resolves simultaneous edits deterministically without locking. Delta state is pushed over secure WebSockets in sub-10ms.
                      </p>
                      <div className="bg-surface border border-border rounded p-6 font-mono text-[10px] text-muted-foreground space-y-3 relative overflow-hidden h-64">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface pointer-events-none z-10" />
                        <motion.div animate={{ y: [0, -40] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                          <div>[SYNC] Client A mutation applied</div>
                          <div>[CRDT] Merging concurrent vector clock...</div>
                          <div className="text-green-500">[RESOLVED] No conflict detected</div>
                          <div>[ACK] Pushing state to edges</div>
                          <div>[SYNC] Client B received Delta</div>
                          <div>[CRDT] Applying local transformation</div>
                          <div>[SYNC] Client A mutation applied</div>
                          <div>[CRDT] Merging concurrent vector clock...</div>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Global Network / Infrastructure Section */}
        <section className="section-inverse min-h-screen flex flex-col justify-center py-16 md:py-20 bg-zinc-950 text-white border-b border-white/5 overflow-hidden relative">
          <div className="container mx-auto px-6 md:px-12 relative z-10">
            {/* Header */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1,
                    delayChildren: 0.2
                  }
                }
              }}
              className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-8"
            >
              <div>
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
                  }}
                  className="font-mono text-xs uppercase tracking-widest text-background/50 mb-4 flex items-center gap-3"
                >
                  <span className="w-2 h-2 bg-accent animate-pulse" /> Infrastructure // Global Network
                </motion.div>
                <motion.h2 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
                  }}
                  className="text-5xl md:text-7xl font-bold tracking-tighter uppercase leading-[0.9]"
                >
                  <BlurText
                    text="Deployed Everywhere."
                    delay={150}
                    animateBy="words"
                    direction="top"
                  />
                </motion.h2>
              </div>
              <motion.p 
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
                }}
                className="text-background/60 font-mono text-sm uppercase tracking-widest max-w-md md:text-right leading-relaxed"
              >
                Operating across 24 regions with military-grade redundancy and automated failover.
              </motion.p>
            </motion.div>

            {/* Global network visualization */}
            <div className="mt-24 md:mt-32">
              {/* Global network — dotted world map */}
              <div className="relative h-[clamp(330px,44vw,620px)] w-full flex items-center justify-center overflow-visible bg-transparent">
                {/* Purple gradient glow */}
                <div
                  className="absolute inset-0 z-0 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(124,92,252,0.22) 0%, rgba(124,92,252,0.07) 40%, transparent 72%)' }}
                />
                <div className="absolute top-5 left-5 z-30 font-mono text-[10px] uppercase tracking-widest text-background/40">
                  FIG.04 — Global Network Map
                </div>
                <div className="absolute top-5 right-5 z-30 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Core Cluster Online
                </div>

                <svg
                  viewBox="0 0 900 450"
                  preserveAspectRatio="xMidYMid meet"
                  className="relative z-10 w-[108%] h-[108%] max-w-none overflow-visible text-background"
                  fill="none"
                  style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 4%, black 18%, black 82%, transparent 96%)', maskImage: 'linear-gradient(to bottom, transparent 4%, black 18%, black 82%, transparent 96%)' }}
                >
                  {(() => {
                    const proj = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * 900, ((90 - lat) / 180) * 450];
                    // Natural Earth land outline filled with a crisp dot pattern (dots only, no outlines).
                    const map = (
                      <g key="worldmap">
                        <defs>
                          <pattern id="landDots" width="6" height="6" patternUnits="userSpaceOnUse">
                            <circle cx="3" cy="3" r="1.25" fill="currentColor" fillOpacity="0.6" />
                          </pattern>
                          <clipPath id="landClip"><path d={WORLD_LAND_PATH} /></clipPath>
                        </defs>
                        <rect x="-100" y="-100" width="1100" height="650" fill="url(#landDots)" clipPath="url(#landClip)" />
                      </g>
                    );

                    const regions = [
                      { c: 'US-WEST', lon: -120, lat: 44, sync: false },
                      { c: 'US-EAST', lon: -77, lat: 38, core: true, sync: false },
                      { c: 'SA-EAST', lon: -46.6, lat: -23.5, sync: true },
                      { c: 'EU-CENTRAL', lon: 8.7, lat: 50, sync: false },
                      { c: 'AP-SOUTH', lon: 72.8, lat: 19, sync: false },
                      { c: 'AP-NE', lon: 139.7, lat: 35.7, sync: false },
                      { c: 'AP-SE', lon: 151, lat: -33.9, sync: false },
                    ];
                    const nodes = regions.map((r) => {
                      const [x, y] = proj(r.lon, r.lat);
                      const color = r.sync ? 'var(--accent)' : r.core ? 'var(--background)' : 'var(--background)';
                      const anchor = x > 820 ? 'end' : x < 80 ? 'start' : 'middle';
                      return (
                        <g key={`node-${r.c}`}>
                          <circle cx={x} cy={y} r={r.core ? 11 : 8} fill="none" stroke={color} strokeOpacity="0.6">
                            <animate attributeName="r" values={r.core ? '11;26' : '8;18'} dur="2.4s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.6;0" dur="2.4s" repeatCount="indefinite" />
                          </circle>
                          <circle cx={x} cy={y} r={r.core ? 6 : 4.5} fill="var(--foreground)" stroke={color} strokeWidth="2" />
                          <circle cx={x} cy={y} r={r.core ? 3 : 2} fill={color} />
                          <text x={x} y={y - (r.core ? 18 : 14)} textAnchor={anchor} fill="currentColor" fillOpacity={r.core ? 0.85 : 0.55} fontFamily="monospace" fontSize="10" fontWeight={r.core ? 'bold' : 'normal'} letterSpacing="1">
                            {r.c}{r.core ? ' • CORE' : ''}
                          </text>
                        </g>
                      );
                    });

                    return (<>{map}{nodes}</>);
                  })()}
                </svg>
              </div>
            </div>
          </div>
        </section>


        {/* Enterprise Capabilities Section */}
        <EnterpriseCapabilities />

        {/* Moving Marquee Section */}
        <div className="section-inverse w-full py-8 bg-foreground text-background overflow-hidden border-t border-border/30">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="flex whitespace-nowrap"
          >
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center">
                <span className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mx-8">
                  Data Integrity
                </span>
                <span className="text-accent">✦</span>
                <span className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mx-8">
                  Global Scale
                </span>
                <span className="text-accent">✦</span>
                <span className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mx-8">
                  Real-Time Sync
                </span>
                <span className="text-accent">✦</span>
              </div>
            ))}
          </motion.div>
        </div>

      </main>

      <PublicFooter />
    </div>
  );
}
