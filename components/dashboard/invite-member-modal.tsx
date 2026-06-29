'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const ROLES = [
  { code: 'ADMIN', label: 'Admin (Organization)' },
  { code: 'PROJECT_MANAGER', label: 'Project Manager' },
  { code: 'TEAM_MANAGER', label: 'Team Manager' },
  { code: 'EMPLOYEE', label: 'Employee' }
];

export function InviteMemberModal({
  onClose, onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [roleCode, setRoleCode] = useState('EMPLOYEE');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !email.includes('@')) { setError('A valid email address is required.'); return; }
    setSubmitting(true);
    setError(null);

    const payload = {
      email: email.trim(),
      role_code: roleCode
    };

    const res = await fetch('/api/v1/members/invite', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const j = await res.json().catch(() => null);
    
    if (!res.ok) {
      setSubmitting(false);
      setError(j?.error?.message ?? 'Failed to invite member.');
      return;
    }
    
    setSubmitting(false);
    if (j?.data?.accept_url) {
      // Show success link (since emails aren't really sent in local dev)
      setSuccessLink(j.data.accept_url);
    } else {
      onInvited();
      onClose();
    }
  }

  const labelCls = 'text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block';
  const fieldCls = 'w-full h-9 px-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-background sm:border sm:border-border sm:shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between shrink-0">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-foreground" /> Invite Member
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {successLink ? (
            <div className="space-y-4">
              <div className="border border-green-500/50 bg-green-500/10 text-green-500 text-sm px-4 py-3 font-mono">
                Invite created successfully. In local dev, emails are not sent. Share this link with the user to accept the invite:
              </div>
              <input 
                type="text" 
                readOnly 
                value={successLink} 
                className={`${fieldCls} font-mono text-xs`}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Email Address *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={fieldCls} placeholder="colleague@example.com" autoFocus />
              </div>

              <div>
                <label className={labelCls}>Role</label>
                <select value={roleCode} onChange={(e) => setRoleCode(e.target.value)} className={fieldCls}>
                  {ROLES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>

              {error && (
                <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
          {successLink ? (
            <button onClick={() => { onInvited(); onClose(); }} className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest">Done</button>
          ) : (
            <>
              <button onClick={onClose} className="h-9 px-4 border border-border font-mono text-xs uppercase tracking-widest">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="h-9 px-4 bg-foreground text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50">
                {submitting ? 'Sending…' : 'Send Invite'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
