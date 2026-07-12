'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Dialog, dialogLabelCls as labelCls, dialogFieldCls as fieldCls } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  return (
    <Dialog
      title="Invite Member"
      icon={UserPlus}
      onClose={onClose}
      className="max-w-lg"
      footer={
        successLink ? (
          <button onClick={() => { onInvited(); onClose(); }} className="h-9 px-4 rounded-[6px] bg-foreground text-background font-mono text-xs uppercase tracking-widest">Done</button>
        ) : (
          <>
            <button onClick={onClose} className="h-9 px-4 border border-border rounded-[6px] font-mono text-xs uppercase tracking-widest">Cancel</button>
            <button onClick={submit} disabled={submitting}
              className="h-9 px-4 bg-foreground rounded-[6px] text-background font-mono text-xs uppercase tracking-widest disabled:opacity-50">
              {submitting ? 'Sending…' : 'Send Invite'}
            </button>
          </>
        )
      }
    >
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
                <Select value={roleCode} onValueChange={setRoleCode}>
                  <SelectTrigger className={fieldCls}>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="border border-red-500/50 bg-red-500/10 text-red-500 text-xs px-3 py-2 font-mono">{error}</div>
              )}
            </>
          )}
    </Dialog>
  );
}

