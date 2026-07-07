'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, KeyRound, Settings, Loader2, Copy, Check, RotateCw, Ban, UserMinus, Crown } from 'lucide-react';
import { useCurrentMembership } from '@/lib/permissions/context';
import { StudentWorkspaceChoices } from '@/components/onboarding/student-workspace-choices';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  roleCode: string;
  labels: string[];
  is_active: boolean;
}

interface JoinCodeStatus {
  id: string;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
  expires_at: string | null;
  last_rotated_at: string | null;
}

export function StudentTeamView({ solo = false }: { solo?: boolean }) {
  const { organizationId, memberId, roles } = useCurrentMembership();
  const isLead = roles.includes('STUDENT_TEAM_LEAD');
  const isCoLead = roles.includes('STUDENT_CO_LEAD');
  const canManage = isLead;

  const [loading, setLoading] = useState(!solo);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [codeStatus, setCodeStatus] = useState<JoinCodeStatus | null>(null);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (solo) return;
    setLoading(true);
    try {
      const [membersRes, codeRes] = await Promise.all([
        fetch(`/api/v1/student-teams/${organizationId}/members`).then((r) => r.json()).catch(() => null),
        canManage ? fetch(`/api/v1/student-teams/${organizationId}/join-code`).then((r) => r.json()) : Promise.resolve(null),
      ]);
      if (membersRes?.data) setMembers(membersRes.data);
      if (codeRes?.data?.status) setCodeStatus(codeRes.data.status);
    } finally {
      setLoading(false);
    }
  }, [solo, organizationId, canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function rotateCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/student-teams/${organizationId}/join-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to rotate code');
      setRevealedCode(data.data.joinCode);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/student-teams/${organizationId}/join-code`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to revoke code');
      setRevealedCode(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(id: string) {
    if (!confirm('Remove this member from the team?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/student-teams/${organizationId}/members/${id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to remove member');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!revealedCode) return;
    navigator.clipboard.writeText(revealedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (solo) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">You don&apos;t have a team yet — create one or join with a code.</p>
        </div>
        <StudentWorkspaceChoices />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Student Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canManage ? 'Manage your team, join code, and members.' : 'Your team and members.'}
        </p>
      </div>

      {error && (
        <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 text-sm font-mono">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          {canManage && (
            <div className="border border-border bg-surface-elevated p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest">
                <KeyRound className="w-4 h-4" /> Join Code Management
              </div>
              {revealedCode ? (
                <div className="p-4 border border-border bg-surface flex items-center justify-between gap-4">
                  <span className="font-mono text-lg tracking-widest">{revealedCode}</span>
                  <button
                    onClick={copyCode}
                    className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border border-border hover:border-foreground/40 flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ) : codeStatus?.is_active ? (
                <div className="text-sm text-muted-foreground">
                  Active code — used {codeStatus.used_count}{codeStatus.max_uses ? ` / ${codeStatus.max_uses}` : ''} times.
                  Rotate to reveal it again (the raw code can&apos;t be recovered).
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No active join code. Generate one to invite teammates.</div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={rotateCode}
                  disabled={busy}
                  className="px-4 py-2 text-xs font-mono uppercase tracking-widest border border-border hover:border-foreground/40 flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Rotate Code
                </button>
                {codeStatus?.is_active && (
                  <button
                    onClick={revokeCode}
                    disabled={busy}
                    className="px-4 py-2 text-xs font-mono uppercase tracking-widest border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" /> Revoke
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="border border-border bg-surface-elevated p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest">
              <Users className="w-4 h-4" /> Team Members
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 border border-border bg-surface">
                  <div className="flex items-center gap-3">
                    {m.roleCode === 'STUDENT_TEAM_LEAD' && <Crown className="w-4 h-4 text-yellow-500" />}
                    <div>
                      <div className="text-sm font-medium">{m.full_name || m.email}</div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {m.roleCode.replace('STUDENT_', '').replace('_', ' ')}
                        {m.labels.length > 0 && ` · ${m.labels.join(', ')}`}
                      </div>
                    </div>
                  </div>
                  {canManage && m.id !== memberId && m.roleCode !== 'STUDENT_TEAM_LEAD' && (
                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={busy}
                      className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
                      title="Remove member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No members loaded.</div>
              )}
            </div>
          </div>

          {(isLead || isCoLead) && (
            <div className="border border-border bg-surface-elevated p-6 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-foreground">
                <Settings className="w-4 h-4" /> Team Settings
              </div>
              <p>Leadership transfer, capacity, and description changes are managed from here in a future update.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
