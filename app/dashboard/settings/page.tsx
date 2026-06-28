'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, Shield, Key, Webhook, Activity, CreditCard
} from 'lucide-react';

interface AuditRow { id: string; action: string; resource_type: string; created_at: string; ip_address: string | null; }

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('org');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    fetch('/api/v1/organizations/current').then((r) => r.json()).then((j) => {
      if (j?.data) { setOrgName(j.data.name ?? ''); setOrgSlug(j.data.slug ?? ''); }
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    fetch('/api/v1/audit-logs').then((r) => r.json()).then((j) => {
      setAuditLogs(Array.isArray(j?.data) ? j.data : []);
    }).catch(() => { });
  }, [activeTab]);

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
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'org', label: 'Organization', icon: Building2 },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'security', label: 'Security & SSO', icon: Shield },
    { id: 'audit', label: 'Audit Logs', icon: Activity },
    { id: 'integrations', label: 'Integrations', icon: Webhook },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage organization settings, security, and billing.</p>
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
        </div>

        {/* Content */}
        <div className="flex-1 w-full space-y-6">
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
                    {auditLogs.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground font-mono text-xs">No audit events.</td></tr>
                    )}
                    {auditLogs.map((log) => (
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

          {activeTab !== 'org' && activeTab !== 'security' && activeTab !== 'audit' && (
            <div className="py-12 text-center border border-border rounded-sm bg-surface border-dashed">
              <p className="text-muted-foreground font-mono text-sm uppercase">This section is not fully implemented in this demo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
