import {
  LayoutDashboard, Briefcase, Inbox, Calendar,
  Layers, KanbanSquare, CheckSquare, GitBranch, ShieldCheck, FileText,
  BarChart3, Settings, Users, AlertCircle,
  Building2, GraduationCap, BookOpen, ClipboardCheck, Award, UserCheck,
  BriefcaseBusiness, Target, Bot, QrCode, ClipboardList, User,
  CalendarClock, CalendarCheck, Flame, Cpu, CreditCard, RadioTower, TableProperties,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardPersona } from '@/lib/auth/dashboard-persona';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * The dashboard's navigation, persona-filtered.
 *
 * Lifted out of components/dashboard/shell.tsx so the desktop sidebar, the ⌘K
 * palette and the native mobile shell all read one source of truth — the role
 * filtering in particular must not be reimplemented per shell.
 *
 * `t` is next-intl's `useTranslations('Nav')` passed in as a plain
 * (key) => string, which keeps this module free of next-intl (and of React),
 * so it is unit-testable with a stub and usable from a server component later
 * if needed.
 */
export function buildNavGroups(t: (key: string) => string, persona: DashboardPersona): NavGroup[] {
  // `roles` array for each item defines which personas can see it.
  // Group titles (Main_SYS, OPS_MGT, ...) are deliberately styled system
  // labels — matching this app's terminal/monospace design language
  // throughout (see e.g. app/ai/page.tsx's "PLATFORM_OVERVIEW") — not
  // natural-language prose, so they're intentionally left untranslated.
  return [
    { title: 'Main_SYS', items: [
      { name: t('overview'), href: '/dashboard', icon: LayoutDashboard },
      { name: t('myWork'), href: '/dashboard/my-work', icon: Briefcase },
      { name: t('myAttendance'), href: '/dashboard/attendance/me', icon: CalendarCheck },
      { name: t('inbox'), href: '/dashboard/inbox', icon: Inbox },
      { name: t('calendar'), href: '/dashboard/calendar', icon: Calendar },
    ]},
    { title: 'OPS_MGT', items: [
      { name: t('projects'), href: '/dashboard/projects', icon: Layers, roles: ['ADMIN'] },
      { name: t('sprints'), href: '/dashboard/sprints', icon: KanbanSquare, roles: ['ADMIN'] },
      { name: t('tasks'), href: '/dashboard/tasks', icon: CheckSquare, roles: ['ADMIN'] },
    ]},
    { title: 'ENG_CORE', items: [
      { name: t('repositories'), href: '/dashboard/repositories', icon: GitBranch, roles: ['ADMIN'] },
      { name: t('qaSecurity'), href: '/dashboard/qa-security', icon: ShieldCheck, roles: ['ADMIN'] },
      { name: t('incidents'), href: '/dashboard/incidents', icon: AlertCircle, roles: ['ADMIN'] },
    ]},
    { title: 'DATA_KNOWLEDGE', items: [
      { name: t('documents'), href: '/dashboard/documents', icon: FileText, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: t('analytics'), href: '/dashboard/analytics', icon: BarChart3, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'EMPLOYER'] },
    ]},
    { title: 'Training_ERP', items: [
      { name: t('institutions'), href: '/dashboard/institutions', icon: Building2, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: t('programmes'), href: '/dashboard/programmes', icon: GraduationCap, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: t('nominations'), href: '/dashboard/nominations', icon: ClipboardList, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: t('logistics'), href: '/dashboard/logistics', icon: CalendarClock, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER'] },
      { name: t('batches'), href: '/dashboard/batches', icon: Users, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER'] },
      { name: t('trainees'), href: '/dashboard/trainees', icon: UserCheck, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER'] },
      { name: t('trainers'), href: '/dashboard/trainers', icon: User, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: t('attendance'), href: '/dashboard/attendance', icon: QrCode, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: t('attendanceLive'), href: '/dashboard/attendance/live', icon: RadioTower, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER'] },
      { name: t('attendanceRegister'), href: '/dashboard/attendance/register', icon: TableProperties, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER'] },
      { name: t('devices'), href: '/dashboard/devices', icon: Cpu, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: t('rfidRegistration'), href: '/dashboard/rfid-registration', icon: CreditCard, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: t('digitalId'), href: '/dashboard/id-card', icon: ShieldCheck, roles: ['TRAINEE'] },
    ]},
    { title: 'Learning_LMS', items: [
      { name: t('myLearning'), href: '/dashboard/my-learning', icon: Flame, roles: ['ADMIN', 'TRAINEE'] },
      { name: t('courses'), href: '/dashboard/courses', icon: BookOpen, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: t('assessments'), href: '/dashboard/assessments', icon: ClipboardCheck, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: t('certificates'), href: '/dashboard/certificates', icon: Award, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINER', 'TRAINEE'] },
      { name: t('skillPassport'), href: '/dashboard/skill-passport', icon: Target, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINEE', 'EMPLOYER'] },
    ]},
    { title: 'Employment', items: [
      { name: t('employers'), href: '/dashboard/employers', icon: BriefcaseBusiness, roles: ['ADMIN', 'INSTITUTE_ADMIN'] },
      { name: t('jobs'), href: '/dashboard/jobs', icon: Briefcase, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'TRAINEE', 'EMPLOYER'] },
      { name: t('applications'), href: '/dashboard/applications', icon: ClipboardList, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'EMPLOYER'] },
    ]},
    { title: 'Cooperative_AI', items: [
      { name: t('careerAi'), href: '/dashboard/career-ai', icon: Bot },
    ]},
    { title: 'Admin_Level', items: [
      { name: t('teams'), href: '/dashboard/teams', icon: Users, roles: ['ADMIN'] },
      { name: t('settings'), href: '/dashboard/settings', icon: Settings, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'EMPLOYER'] },
    ]},
  ].map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      if (!('roles' in it)) return true; // Available to everyone
      return (it as NavItem).roles!.includes(persona) || persona === 'ADMIN';
    }),
  }))
  .filter((g) => g.items.length > 0);
}

/**
 * Preferred bottom-tab destinations per persona, most-used first.
 *
 * These are *preferences*, not guarantees — resolveMobileTabs() looks each one
 * up in the already-filtered groups, so a tab can never point somewhere the
 * persona cannot actually see.
 *
 * resolveDashboardPersona returns eight personas but the nav's `roles` arrays
 * only ever name five; PROJECT_MANAGER / TEAM_MANAGER / EMPLOYEE therefore see
 * only the unrestricted Main_SYS items plus Career AI, and their preferences
 * stay inside that set.
 */
const MOBILE_TAB_PREFERENCES: Record<DashboardPersona, string[]> = {
  TRAINEE: ['/dashboard', '/dashboard/my-learning', '/dashboard/courses', '/dashboard/attendance'],
  TRAINER: ['/dashboard', '/dashboard/batches', '/dashboard/attendance', '/dashboard/assessments'],
  INSTITUTE_ADMIN: ['/dashboard', '/dashboard/trainees', '/dashboard/batches', '/dashboard/analytics'],
  EMPLOYER: ['/dashboard', '/dashboard/jobs', '/dashboard/applications', '/dashboard/skill-passport'],
  ADMIN: ['/dashboard', '/dashboard/my-work', '/dashboard/tasks', '/dashboard/analytics'],
  PROJECT_MANAGER: ['/dashboard', '/dashboard/my-work', '/dashboard/inbox', '/dashboard/calendar'],
  TEAM_MANAGER: ['/dashboard', '/dashboard/my-work', '/dashboard/inbox', '/dashboard/calendar'],
  EMPLOYEE: ['/dashboard', '/dashboard/my-work', '/dashboard/inbox', '/dashboard/calendar'],
};

/** How many destinations the bottom tab bar shows before the "More" slot. */
export const MOBILE_TAB_COUNT = 4;

/**
 * The bottom-tab destinations for a persona: up to MOBILE_TAB_COUNT items,
 * every one of them guaranteed present in `groups`.
 *
 * Falls back to whatever the persona can see (in nav order) if its preferences
 * don't resolve — so a persona with an unusual role mix still gets a usable
 * tab bar rather than an empty one. The remaining destinations live behind
 * "More", which the tab bar renders itself.
 */
export function resolveMobileTabs(groups: NavGroup[], persona: DashboardPersona): NavItem[] {
  const available = groups.flatMap((g) => g.items);
  const byHref = new Map(available.map((it) => [it.href, it]));

  const tabs: NavItem[] = [];
  for (const href of MOBILE_TAB_PREFERENCES[persona] ?? []) {
    const item = byHref.get(href);
    if (item && !tabs.includes(item)) tabs.push(item);
    if (tabs.length === MOBILE_TAB_COUNT) return tabs;
  }

  for (const item of available) {
    if (tabs.length === MOBILE_TAB_COUNT) break;
    if (!tabs.includes(item)) tabs.push(item);
  }
  return tabs;
}
