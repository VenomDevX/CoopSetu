'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useCurrentMembership } from '@/lib/permissions/context';
import {
  Building2, Users, Shield, Key, Webhook, Activity, CreditCard, MonitorSmartphone,
  Eye, EyeOff, Check, X, Loader2, Lock, User, Camera, Save, Trash2, AlertTriangle
} from 'lucide-react';

interface AuditRow { id: string; action: string; resource_type: string; created_at: string; ip_address: string | null; }
interface SessionRow { id: string; ip: string | null; user_agent: string | null; created_at: string; updated_at: string; }

const MOCK_USERS = [
  { id: '1', name: 'Alice Admin', email: 'alice@handoff.app', role: 'ORG_ADMIN', status: 'Active', lastActive: 'Just now' },
  { id: '2', name: 'Bob Builder', email: 'bob@handoff.app', role: 'DEVELOPER', status: 'Active', lastActive: '2 hrs ago' },
  { id: '3', name: 'Charlie Check', email: 'charlie@handoff.app', role: 'QA_ENGINEER', status: 'Invited', lastActive: 'Never' },
  { id: '4', name: 'Dana Design', email: 'dana@handoff.app', role: 'DESIGNER', status: 'Active', lastActive: 'Yesterday' }
];

const MOCK_INTEGRATIONS = [
  { id: 'github', name: 'GitHub', description: 'Link repositories and pull requests to tasks.', connected: false, icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' },
  { id: 'slack', name: 'Slack', description: 'Receive project updates and alerts in channels.', connected: false, icon: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png' },
  { id: 'jira', name: 'Jira', description: 'Sync issues and epics bidirectionally with Handoff.', connected: false, icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/jira/jira-original.svg' },
  { id: 'datadog', name: 'Datadog', description: 'Monitor application performance and errors.', connected: false, icon: 'https://www.datadoghq.com/favicon.ico' },
];

const MOCK_INVOICES = [
  { id: 'INV-2026-004', date: 'Jul 1, 2026', amount: '$299.00', status: 'Paid' },
  { id: 'INV-2026-003', date: 'Jun 1, 2026', amount: '$299.00', status: 'Paid' },
  { id: 'INV-2026-002', date: 'May 1, 2026', amount: '$299.00', status: 'Paid' },
];

const TAB_IDS = ['profile', 'org', 'users', 'security', 'sessions', 'password', 'audit', 'integrations', 'billing'];
const STUDENT_TAB_IDS = ['profile', 'sessions', 'password'];

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceType } = useCurrentMembership();
  const isStudent = workspaceType !== 'ENTERPRISE';
  const allowedTabIds = useMemo(() => (
    isStudent
      ? (workspaceType === 'STUDENT_SOLO' ? [...STUDENT_TAB_IDS, 'workspace'] : STUDENT_TAB_IDS)
      : TAB_IDS
  ), [isStudent, workspaceType]);
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(requestedTab && allowedTabIds.includes(requestedTab) ? requestedTab : 'profile');

  // Sync tab when the URL changes while already on this page (e.g. header dropdown links).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (requestedTab && allowedTabIds.includes(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab, allowedTabIds]);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [ipAllowlist, setIpAllowlist] = useState('');
  const { data: connectedIntegrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => apiGet<{ id: string; provider: string; status: string }[]>('/api/v1/integrations'),
  });
  const integrationsState = useMemo(() => (
    MOCK_INTEGRATIONS.map((integration) => ({
      ...integration,
      connected: connectedIntegrations?.some((i) => i.provider === integration.id && i.status === 'ACTIVE') ?? false,
    }))
  ), [connectedIntegrations]);

  // Profile form
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // STUDENT_SOLO workspace settings
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceMsg, setWorkspaceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteWorkspaceDialog, setShowDeleteWorkspaceDialog] = useState(false);
  const [deleteWorkspaceConfirmation, setDeleteWorkspaceConfirmation] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<string | null>(null);

  const { data: org } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: () => apiGet<{ name?: string; slug?: string; description?: string; ip_allowlist?: string[] }>('/api/v1/organizations/current'),
  });

  useEffect(() => {
    // Check URL parameters for OAuth callbacks
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('integration') === 'success') {
      alert('GitHub integration successfully connected!');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (searchParams.get('integration_error')) {
      alert(`Integration failed: ${searchParams.get('integration_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!org) return;
    queueMicrotask(() => {
      setOrgName(org.name ?? '');
      setOrgSlug(org.slug ?? '');
      setIpAllowlist(Array.isArray(org.ip_allowlist) ? org.ip_allowlist.join(', ') : '');
      setWorkspaceName(org.name ?? '');
      setWorkspaceDescription(org.description ?? '');
    });
  }, [org]);

  useEffect(() => {
    fetch('/api/v1/profile')
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          setProfile(res.data);
          setFullName(res.data.fullName);
          setUsername(res.data.username);
          setAvatarPreview(res.data.avatarUrl);
        }
      })
      .catch(console.error);
  }, []);

  const {
    data: auditLogs = [],
    isPending: auditLoading,
    isError: auditError,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiGet<AuditRow[]>('/api/v1/audit-logs'),
    enabled: activeTab === 'audit',
  });

  const {
    data: sessions = [],
    isPending: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiGet<SessionRow[]>('/api/v1/sessions'),
    enabled: activeTab === 'sessions',
  });

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/v1/organizations/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, slug: orgSlug })
      });
      if (res.ok) alert('Settings saved successfully');
      else alert('Failed to save settings');
    } catch (e) {
      alert('Error saving settings');
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Update failed');
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: unknown) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch('/api/v1/profile/avatar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
      setAvatarPreview(data.data.avatarUrl);
      setProfileMsg({ type: 'success', text: 'Avatar updated!' });
    } catch (err: unknown) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch('/api/v1/profile/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove avatar');
      setAvatarPreview(null);
      setProfileMsg({ type: 'success', text: 'Avatar removed.' });
    } catch (err: unknown) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Remove failed' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveIPAllowlist = async () => {
    // Parse comma-separated list into an array
    const allowlistArray = ipAllowlist.split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);

    try {
      // First try to fetch the client's current IP to implement a basic safe harbor warning
      let currentIp = 'Unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
          const { ip } = await ipRes.json();
          currentIp = ip;
        }
      } catch (e) {
        // Ignore ipify errors
      }

      if (allowlistArray.length > 0 && currentIp !== 'Unknown' && !allowlistArray.some(allowed => currentIp === allowed || allowed.includes('/'))) {
        if (!confirm(`WARNING: Your current IP (${currentIp}) does not appear to be in the allowlist. You may lock yourself out immediately upon saving. Are you sure you want to proceed?`)) {
          return;
        }
      }

      const res = await fetch('/api/v1/organizations/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_allowlist: allowlistArray })
      });
      if (res.ok) alert('IP Allowlist updated successfully.');
      else {
        const data = await res.json();
        alert(`Failed to update IP Allowlist: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (e) {
      alert('Error saving IP Allowlist');
    }
  };

  const handleConfigureIdP = () => {
    alert('SSO/IdP Configuration is disabled in the local development environment.');
  };

  const handleExportCSV = () => {
    if (auditLogs.length === 0) {
      alert('No audit logs to export');
      return;
    }
    const headers = ['Timestamp', 'Actor', 'Action', 'Resource', 'IP Address'];
    const csvContent = [
      headers.join(','),
      ...auditLogs.map(row =>
        [
          new Date(row.created_at).toLocaleString(),
          'System/User',
          row.action,
          row.resource_type,
          row.ip_address || 'Unknown'
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to log out of this device?')) return;
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        refetchSessions();
      } else {
        alert('Failed to revoke session');
      }
    } catch {
      alert('Error revoking session');
    }
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Edg/')) return 'Edge (' + (ua.includes('Windows') ? 'Windows' : 'Mac') + ')';
    if (ua.includes('Chrome/')) return 'Chrome (' + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'Mac' : 'Linux') + ')';
    if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari (Mac/iOS)';
    if (ua.includes('Firefox/')) return 'Firefox';
    return 'Other Device';
  };

  const handleChangePassword = async () => {
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch('/api/v1/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to change password');
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/v1/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to delete account');

      router.push('/login');
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeletingAccount(false);
    }
  };

  const handleSaveWorkspace = async () => {
    setSavingWorkspace(true);
    setWorkspaceMsg(null);
    try {
      const res = await fetch('/api/v1/student-workspaces/solo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName, description: workspaceDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to update workspace');
      setWorkspaceMsg({ type: 'success', text: 'Workspace updated successfully!' });
    } catch (err: unknown) {
      setWorkspaceMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update workspace' });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    setDeletingWorkspace(true);
    setDeleteWorkspaceError(null);
    try {
      const res = await fetch('/api/v1/student-workspaces/solo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteWorkspaceConfirmation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to delete workspace');

      router.push('/onboarding');
      router.refresh();
    } catch (err: unknown) {
      setDeleteWorkspaceError(err instanceof Error ? err.message : 'Failed to delete workspace');
      setDeletingWorkspace(false);
    }
  };

  const getPasswordStrength = (pw: string): { label: string; width: string; color: string } => {
    if (!pw) return { label: '', width: '0%', color: '' };
    let score = 0;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', width: '33%', color: 'bg-red-500' };
    if (score <= 3) return { label: 'Fair', width: '50%', color: 'bg-yellow-500' };
    if (score <= 4) return { label: 'Strong', width: '75%', color: 'bg-primary' };
    return { label: 'Very Strong', width: '100%', color: 'bg-green-500' };
  };
  const strength = getPasswordStrength(newPassword);

  const allTabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'org', label: 'Organization', icon: Building2 },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'security', label: 'Security & SSO', icon: Shield },
    { id: 'sessions', label: 'Active Sessions', icon: MonitorSmartphone },
    { id: 'password', label: 'Change Password', icon: Key },
    { id: 'audit', label: 'Audit Logs', icon: Activity },
    { id: 'integrations', label: 'Integrations', icon: Webhook },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];
  // Enterprise-only tabs (Organization/Users & Roles/Security & SSO/Audit Logs/
  // Integrations/Billing) are never rendered for student workspaces — not just
  // visually disabled.
  const tabs = allTabs.filter(t => allowedTabIds.includes(t.id));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{isStudent ? 'Account Settings' : 'Administration'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isStudent ? 'Manage your account and security.' : 'Manage organization settings, security, and billing.'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors ${activeTab === tab.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
          {workspaceType === 'STUDENT_TEAM' && (
            <button
              onClick={() => router.push('/dashboard/teams')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <Users className="w-4 h-4" />
              Student Team
            </button>
          )}
          {workspaceType === 'STUDENT_SOLO' && (
            <button
              onClick={() => setActiveTab('workspace')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors ${activeTab === 'workspace'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                }`}
            >
              <Building2 className="w-4 h-4" />
              Workspace
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 w-full space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl">
              <Card className="shadow-sm border-border bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-foreground text-sm font-mono uppercase tracking-widest flex items-center gap-2">
                    <Camera className="w-4 h-4 text-accent" /> Profile Picture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center text-2xl font-bold text-white overflow-hidden ring-2 ring-accent/20">
                        {avatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{fullName ? fullName.charAt(0).toUpperCase() : 'U'}</span>
                        )}
                        {uploadingAvatar && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:bg-accent/80 transition-colors"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium mb-1">{fullName || 'Your Name'}</p>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                        JPG, PNG, WebP or GIF. Max 2MB.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Upload New
                        </button>
                        {avatarPreview && (
                          <button
                            onClick={handleRemoveAvatar}
                            className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border border-border hover:border-red-400/50 text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-foreground text-sm font-mono uppercase tracking-widest flex items-center gap-2">
                    <User className="w-4 h-4 text-accent" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Full Name</label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="bg-surface border-border focus:border-border-strong rounded-sm text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Username</label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="johndoe"
                        className="bg-surface border-border focus:border-border-strong rounded-sm text-sm"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {profileMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`px-4 py-3 text-xs font-mono uppercase tracking-widest flex items-center gap-2 rounded-sm ${
                          profileMsg.type === 'success'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {profileMsg.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {profileMsg.text}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-4 flex items-center justify-end">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile || !fullName}
                      className="bg-foreground text-background hover:bg-foreground/90 rounded-sm gap-2"
                    >
                      {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-red-500/30 bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-red-400 text-sm font-mono uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Danger Zone
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Permanently delete your account and all personal data. This cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border border-red-500/20 bg-red-500/5 rounded-sm">
                    <div>
                      <div className="font-medium text-sm text-foreground">Delete Account</div>
                      <div className="text-xs text-muted-foreground mt-1 max-w-md">
                        If you solely own an organization with other members, transfer ownership or remove them first — account deletion will be blocked otherwise.
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      className="rounded-sm gap-2 shrink-0"
                      onClick={() => { setDeleteError(null); setDeleteConfirmation(''); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'org' && (
            <Card className="shadow-sm border-border bg-surface-elevated">
              <CardHeader>
                <CardTitle className="text-foreground">Organization Profile</CardTitle>
                <CardDescription className="text-muted-foreground">Manage your company details and branding.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Company Name</label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="max-w-md bg-surface border-border text-foreground focus:border-border-strong rounded-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Workspace URL</label>
                  <div className="flex items-center gap-0 max-w-md">
                    <span className="text-muted-foreground bg-surface border border-r-0 border-border rounded-l-sm px-3 h-10 flex items-center text-sm">https://</span>
                    <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} className="flex-1 rounded-none border-border bg-surface text-foreground focus:border-border-strong focus:z-10" />
                    <span className="text-muted-foreground bg-surface border border-l-0 border-border rounded-r-sm px-3 h-10 flex items-center text-sm">.handoff.app</span>
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={handleSaveSettings} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm">Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'workspace' && (
            <div className="space-y-6 max-w-2xl">
              <Card className="shadow-sm border-border bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-foreground">Workspace</CardTitle>
                  <CardDescription className="text-muted-foreground">Rename your personal workspace or update its description.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Workspace Name</label>
                    <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="max-w-md bg-surface border-border text-foreground focus:border-border-strong rounded-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <textarea
                      value={workspaceDescription}
                      onChange={(e) => setWorkspaceDescription(e.target.value)}
                      rows={3}
                      className="w-full max-w-md bg-surface border border-border rounded-sm text-sm text-foreground p-3 focus:outline-none focus:border-border-strong"
                    />
                  </div>
                  {workspaceMsg && (
                    <div className={`px-4 py-3 text-xs font-mono uppercase tracking-widest rounded-sm ${workspaceMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {workspaceMsg.text}
                    </div>
                  )}
                  <div className="pt-4">
                    <Button onClick={handleSaveWorkspace} disabled={savingWorkspace || !workspaceName} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm">
                      {savingWorkspace ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-red-500/30 bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-red-400">Danger Zone</CardTitle>
                  <CardDescription className="text-muted-foreground">Permanently delete this workspace and all its data.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4 p-4 border border-red-500/20 bg-red-500/10 rounded-sm">
                    <div>
                      <div className="font-medium text-sm text-foreground mb-1">Delete Workspace</div>
                      <p className="text-xs text-muted-foreground">This cannot be undone. Your account itself is not affected.</p>
                    </div>
                    <Button variant="destructive" className="rounded-sm gap-2 shrink-0" onClick={() => setShowDeleteWorkspaceDialog(true)}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'password' && (
            <Card className="shadow-sm border-border bg-surface-elevated">
              <CardHeader>
                <CardTitle className="text-foreground">Change Password</CardTitle>
                <CardDescription className="text-muted-foreground">Update your personal account password securely.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Current Password</label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-surface border-border text-foreground focus:border-border-strong rounded-sm pr-10"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-surface border-border text-foreground focus:border-border-strong rounded-sm pr-10"
                      placeholder="Min 12 chars, uppercase, number, special"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="mt-2">
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: strength.width }}
                          className={`h-full ${strength.color}`}
                        />
                      </div>
                      <p className={`text-[10px] font-mono uppercase tracking-widest mt-1 ${
                        strength.label === 'Weak' ? 'text-red-400' :
                        strength.label === 'Fair' ? 'text-yellow-400' :
                        'text-primary'
                      }`}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Confirm New Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-surface border-border text-foreground focus:border-border-strong rounded-sm pr-10"
                      placeholder="Repeat new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                <AnimatePresence>
                  {passwordMsg && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`px-4 py-3 text-xs font-mono uppercase tracking-widest flex items-center gap-2 rounded-sm ${
                        passwordMsg.type === 'success'
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {passwordMsg.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {passwordMsg.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4">
                  <Button
                    onClick={handleChangePassword}
                    disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    className="bg-foreground text-background hover:bg-foreground/90 rounded-sm w-full gap-2"
                  >
                    {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card className="shadow-sm border-foreground bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-foreground">Single Sign-On (SSO)</CardTitle>
                  <CardDescription className="text-muted-foreground">Configure SAML or OIDC for enterprise identity.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-sm bg-surface">
                    <div>
                      <div className="font-medium text-foreground">Okta SAML 2.0</div>
                      <div className="text-sm text-muted-foreground">Currently active for all domain users.</div>
                    </div>
                    <Badge className="bg-surface-hover text-foreground border-border font-mono text-[10px] uppercase rounded-sm">Active</Badge>
                  </div>
                  <Button onClick={handleConfigureIdP} variant="outline" className="bg-surface-elevated text-foreground border-border hover:bg-surface-hover rounded-sm">Configure IdP</Button>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-foreground">Security Policies</CardTitle>
                  <CardDescription className="text-muted-foreground">Enforce workspace security requirements.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-foreground">Require Multi-Factor Authentication</div>
                      <div className="text-xs text-muted-foreground">Enforce MFA for all workspace members.</div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded-sm border-border text-primary bg-surface focus:ring-primary" />
                  </div>
                  
                  <div className="pt-6 border-t border-border mt-6">
                    <div className="font-medium text-sm text-foreground mb-1">Organization IP Allowlisting</div>
                    <div className="text-xs text-muted-foreground mb-4">
                      Restrict access to the platform to specific IP addresses or CIDR blocks. Leave empty to allow all IPs. Enter values separated by commas (e.g., <code>192.168.1.1, 10.0.0.0/24</code>).
                    </div>
                    <div className="flex gap-4">
                      <Input 
                        placeholder="e.g., 203.0.113.5, 198.51.100.0/24" 
                        value={ipAllowlist}
                        onChange={(e) => setIpAllowlist(e.target.value)}
                        className="bg-surface text-foreground"
                      />
                      <Button onClick={handleSaveIPAllowlist}>Save</Button>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-foreground">Session Timeout</div>
                      <div className="text-xs text-muted-foreground">Automatically log out idle users.</div>
                    </div>
                    <select className="border border-border bg-surface text-foreground rounded-sm text-sm px-2 py-1 outline-none focus:border-border-strong">
                      <option>12 hours</option>
                      <option>24 hours</option>
                      <option>7 days</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'audit' && (
            <Card className="shadow-sm border-border bg-surface-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">Audit Logs</CardTitle>
                    <CardDescription className="text-muted-foreground">Security and compliance event tracking.</CardDescription>
                  </div>
                  <Button onClick={handleExportCSV} variant="outline" size="sm" className="bg-surface-elevated text-foreground border-border hover:bg-surface-hover rounded-sm">Export CSV</Button>
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full min-w-[640px] text-sm text-left border-collapse">
                  <thead className="text-xs text-muted-foreground bg-surface font-mono uppercase border-y border-border">
                    <tr>
                      <th className="px-4 py-2 font-medium">Timestamp</th>
                      <th className="px-4 py-2 font-medium">Actor</th>
                      <th className="px-4 py-2 font-medium">Event</th>
                      <th className="px-4 py-2 font-medium">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLoading && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground font-mono text-xs">Loading audit logs...</td></tr>
                    )}
                    {!auditLoading && auditError && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center">
                          <div className="text-xs text-destructive mb-3">Failed to load audit logs.</div>
                          <Button variant="outline" size="sm" onClick={() => refetchAudit()}>Retry</Button>
                        </td>
                      </tr>
                    )}
                    {!auditLoading && !auditError && auditLogs.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground font-mono text-xs">No audit events.</td></tr>
                    )}
                    {!auditLoading && !auditError && auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{log.resource_type}</td>
                        <td className="px-4 py-3 text-foreground"><Badge variant="secondary" className="bg-surface text-foreground border-border font-mono font-normal text-[10px] uppercase rounded-sm">{log.action}</Badge></td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground opacity-70">{log.ip_address ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {activeTab === 'users' && (
            <Card className="shadow-sm border-border bg-surface-elevated">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-foreground">Users & Roles</CardTitle>
                    <CardDescription className="text-muted-foreground">Manage members and their permissions in your organization.</CardDescription>
                  </div>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm">Invite Member</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm text-left border-collapse">
                    <thead className="text-xs text-muted-foreground bg-surface font-mono uppercase border-y border-border">
                      <tr>
                        <th className="px-4 py-2 font-medium">User</th>
                        <th className="px-4 py-2 font-medium">Role</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium text-right">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {MOCK_USERS.map((user) => (
                        <tr key={user.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{user.name}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="bg-surface border-border font-mono font-normal text-[10px] uppercase rounded-sm">{user.role}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={user.status === 'Active' ? 'text-green-500 border-green-500/20 bg-green-500/10 rounded-sm' : 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10 rounded-sm'}>
                              {user.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                            {user.lastActive}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'sessions' && (
            <Card className="shadow-sm border-border bg-surface-elevated">
              <CardHeader>
                <CardTitle className="text-foreground">Active Sessions</CardTitle>
                <CardDescription className="text-muted-foreground">Review and revoke active login sessions for your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm text-left border-collapse">
                    <thead className="text-xs text-muted-foreground bg-surface font-mono uppercase border-y border-border">
                      <tr>
                        <th className="px-4 py-2 font-medium">Device / Browser</th>
                        <th className="px-4 py-2 font-medium">IP Address</th>
                        <th className="px-4 py-2 font-medium">Last Seen</th>
                        <th className="px-4 py-2 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sessionsLoading && (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground font-mono text-xs">Loading sessions...</td></tr>
                      )}
                      {!sessionsLoading && sessionsError && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center">
                            <div className="text-xs text-destructive mb-3">Failed to load sessions.</div>
                            <Button variant="outline" size="sm" onClick={() => refetchSessions()}>Retry</Button>
                          </td>
                        </tr>
                      )}
                      {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground font-mono text-xs">No active sessions.</td></tr>
                      )}
                      {!sessionsLoading && !sessionsError && sessions.map((session) => (
                        <tr key={session.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{parseUserAgent(session.user_agent)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{session.ip ?? 'Unknown'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(session.updated_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => handleRevokeSession(session.id)} className="h-7 text-xs rounded-sm text-destructive border-destructive/20 hover:bg-destructive/10">Revoke</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <Card className="shadow-sm border-border bg-surface-elevated">
              <CardHeader>
                <CardTitle className="text-foreground">Integrations</CardTitle>
                <CardDescription className="text-muted-foreground">Connect Handoff with your favorite tools.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {integrationsState.map((integration) => (
                    <div key={integration.id} className="p-4 border border-border rounded-sm bg-surface flex flex-col justify-between">
                      <div className="flex items-start gap-4 mb-4">
                        <img src={integration.icon} alt={integration.name} className="w-10 h-10 rounded-sm bg-white p-1 object-contain" />
                        <div>
                          <h3 className="font-bold text-foreground">{integration.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{integration.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-border border-dashed">
                        <Badge variant="outline" className={integration.connected ? 'text-green-500 border-green-500/20 bg-green-500/10 rounded-sm' : 'text-muted-foreground border-border bg-transparent rounded-sm'}>
                          {integration.connected ? 'Connected' : 'Not Connected'}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant={integration.connected ? 'outline' : 'default'} 
                          className={integration.connected ? "rounded-sm" : "bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm"}
                          onClick={() => {
                            if (integration.id === 'github') {
                              window.location.href = '/api/v1/integrations/github/auth';
                            } else {
                              alert(`${integration.name} integration is not fully implemented in this demo.`);
                            }
                          }}
                        >
                          {integration.connected ? 'Configure' : 'Connect'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <Card className="shadow-sm border-border bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-foreground">Subscription Plan</CardTitle>
                  <CardDescription className="text-muted-foreground">Manage your billing plan and payment methods.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-sm bg-surface gap-4">
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        Enterprise Demo Plan
                        <Badge className="bg-primary/20 text-primary border-transparent font-mono text-[10px] uppercase rounded-sm">Current</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Unlimited projects, full feature access.</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl">$299<span className="text-sm text-muted-foreground font-normal">/mo</span></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Seats Used (4/50)</span>
                      <span className="font-medium">8%</span>
                    </div>
                    <div className="w-full bg-surface border border-border rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '8%' }}></div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button variant="outline" className="rounded-sm border-border bg-transparent text-foreground hover:bg-surface">Manage Subscription</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border bg-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-foreground text-lg">Invoice History</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-xs text-muted-foreground bg-surface font-mono uppercase border-y border-border">
                      <tr>
                        <th className="px-4 py-2 font-medium">Invoice ID</th>
                        <th className="px-4 py-2 font-medium">Date</th>
                        <th className="px-4 py-2 font-medium">Amount</th>
                        <th className="px-4 py-2 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {MOCK_INVOICES.map((inv) => (
                        <tr key={inv.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{inv.id}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.date}</td>
                          <td className="px-4 py-3 font-medium">{inv.amount}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-transparent rounded-sm font-normal">
                              {inv.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {showDeleteDialog && (
        <Dialog
          title="Delete Account"
          onClose={() => { if (!deletingAccount) setShowDeleteDialog(false); }}
          footer={
            <>
              <Button
                variant="outline"
                className="rounded-sm"
                disabled={deletingAccount}
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-sm gap-2"
                disabled={deletingAccount || deleteConfirmation.trim().toLowerCase() !== (profile?.email ?? '').toLowerCase()}
                onClick={handleDeleteAccount}
              >
                {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete My Account
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3 p-4 border border-red-500/20 bg-red-500/10 rounded-sm">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              This permanently deletes your account, profile, and all associated data. Organizations you solely
              own will also be deleted if no other members remain. This action cannot be undone.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Type <span className="font-mono text-red-400">{profile?.email}</span> to confirm
            </label>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={profile?.email ?? 'your@email.com'}
              className="bg-surface border-border focus:border-border-strong rounded-sm text-sm"
              autoFocus
            />
          </div>

          {deleteError && (
            <div className="px-4 py-3 text-xs font-mono uppercase tracking-widest flex items-center gap-2 rounded-sm bg-red-500/10 text-red-400 border border-red-500/20">
              <X className="w-4 h-4 shrink-0" /> {deleteError}
            </div>
          )}
        </Dialog>
      )}

      {showDeleteWorkspaceDialog && (
        <Dialog
          title="Delete Workspace"
          onClose={() => { if (!deletingWorkspace) setShowDeleteWorkspaceDialog(false); }}
          footer={
            <>
              <Button
                variant="outline"
                className="rounded-sm"
                disabled={deletingWorkspace}
                onClick={() => setShowDeleteWorkspaceDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-sm gap-2"
                disabled={deletingWorkspace || deleteWorkspaceConfirmation.trim() !== workspaceName}
                onClick={handleDeleteWorkspace}
              >
                {deletingWorkspace ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Workspace
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3 p-4 border border-red-500/20 bg-red-500/10 rounded-sm">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              This permanently deletes this workspace and all its projects, tasks, and data. Your account is not
              affected. This action cannot be undone.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Type <span className="font-mono text-red-400">{workspaceName}</span> to confirm
            </label>
            <Input
              value={deleteWorkspaceConfirmation}
              onChange={(e) => setDeleteWorkspaceConfirmation(e.target.value)}
              placeholder={workspaceName}
              className="bg-surface border-border focus:border-border-strong rounded-sm text-sm"
              autoFocus
            />
          </div>

          {deleteWorkspaceError && (
            <div className="px-4 py-3 text-xs font-mono uppercase tracking-widest flex items-center gap-2 rounded-sm bg-red-500/10 text-red-400 border border-red-500/20">
              <X className="w-4 h-4 shrink-0" /> {deleteWorkspaceError}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
