'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronsUpDown, Check } from 'lucide-react';
import { useCurrentMembership } from '@/lib/permissions/context';

interface Org { id: string; name: string; slug: string }

export function OrgSwitcher() {
  const membership = useCurrentMembership();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/v1/organizations')
      .then((r) => r.json())
      .then((j) => setOrgs(Array.isArray(j?.data) ? j.data : []))
      .catch(() => {});
  }, []);

  async function switchOrg(id: string) {
    if (id === membership.organizationId) { setOpen(false); return; }
    setBusy(true);
    const res = await fetch('/api/v1/organizations/active', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: id }),
    });
    setBusy(false);
    setOpen(false);
    if (res.ok) { router.push('/dashboard'); router.refresh(); }
  }

  // Single-org users don't need a switcher.
  if (orgs.length <= 1) {
    return (
      <div className="font-mono text-[10px] uppercase tracking-widest truncate text-muted-foreground">
        {membership.organizationName}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <span className="truncate max-w-[120px]">{membership.organizationName}</span>
        <ChevronsUpDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-56 bg-background border border-border rounded z-50 shadow-lg">
          {orgs.map((o) => (
            <button key={o.id} onClick={() => switchOrg(o.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-hover text-left">
              <span className="truncate">{o.name}</span>
              {o.id === membership.organizationId && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
