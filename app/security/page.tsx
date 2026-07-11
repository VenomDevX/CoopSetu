'use client';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { AiLogo } from '@/components/ai/ai-logo';

import React from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/components/layout/public-footer';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  CheckCircle2, 
  Terminal, 
  Loader2,
  Lock,
  Shield,
  FileText,
  Search,
  MessageSquare,
  BarChart3,
  GitPullRequest,
  Database,
  Eye,
  AlertCircle,
  FileCode2,
  Zap,
  ArrowDown,
  Key,
  Users,
  Clock,
  Fingerprint
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SecurityPage() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navType, setNavType] = React.useState<string | null>(null);
  
  // Mock interactive states
  const [isReviewed, setIsReviewed] = React.useState(false);
  const [exportState, setExportState] = React.useState<'idle' | 'exporting' | 'done'>('idle');

  const handleExportCSV = () => {
    setExportState('exporting');
    setTimeout(() => {
      // Create a mock CSV download
      const csvContent = "data:text/csv;charset=utf-8,Timestamp,Actor,EventType,Resource,IPAddress\n2026-06-28T10:00:00Z,admin@handoff.dev,LOGIN,System,192.168.1.1\n";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "handoff_audit_log.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setExportState('done');
      setTimeout(() => setExportState('idle'), 3000);
    }, 1500);
  };

  const handleNavigate = (path: string, type: string) => {
    setNavType(type);
    setIsNavigating(true);
    router.push(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-200">
      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-24">
        {/* HERO SECTION */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              SECURITY_AND_CONTROL
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              Built for work that requires accountability.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              HANDOFF Enterprise helps organizations control access, protect delivery information, enforce approvals, and maintain a complete record of how work moves to production.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/contact', 'security')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Talk to Security
              </Button>
              <Button 
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Request Demo
              </Button>
            </div>
          </div>

          {/* Hero Visual - Security Console */}
          <div className="w-full bg-surface-elevated border border-border rounded p-4 shadow-2xl relative overflow-hidden max-w-5xl mx-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
            
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-4">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">Workspace Security Policy</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 text-orange-500 bg-orange-500/10 px-2 py-0.5 border border-orange-500/20">
                  <Lock className="w-3 h-3" />
                  RESTRICTED WORKSPACE
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-4">
                <div className="border border-border rounded bg-background p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Identity Provider</div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold">SSO Enforced</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">MFA Required</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                </div>
                <div className="border border-border rounded bg-background p-4 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Recent Audit Records</div>
                  <div className="space-y-2 font-mono text-[10px]">
                    <div className="flex justify-between items-center opacity-70">
                      <span>e.rodriguez modified policy</span>
                      <span>2m ago</span>
                    </div>
                    <div className="flex justify-between items-center opacity-70">
                      <span>s.jenkins approved release</span>
                      <span>15m ago</span>
                    </div>
                    <div className="flex justify-between items-center opacity-70 text-orange-500">
                      <span>Failed login attempt (IP block)</span>
                      <span>1h ago</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-2 border border-border rounded bg-background p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                  <span>Active Release Approvals</span>
                  <span className="text-accent">PIPELINE-24</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-surface p-3 border border-border rounded">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">QA Sign-off</div>
                      <div className="text-[10px] font-mono text-muted-foreground">Approved by QA_Team</div>
                    </div>
                    <div className="text-[10px] font-mono">10:42 AM</div>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-surface p-3 border border-border rounded">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">Security Review</div>
                      <div className="text-[10px] font-mono text-muted-foreground">Approved by Sec_Ops</div>
                    </div>
                    <div className="text-[10px] font-mono">11:15 AM</div>
                  </div>

                  <div className="flex items-center gap-4 bg-background border border-accent/30 p-3 shadow-[0_0_15px_rgba(var(--accent),0.05)]">
                    <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">Compliance Approval</div>
                      <div className="text-[10px] font-mono text-muted-foreground">Awaiting Director Sign-off</div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => setIsReviewed(true)}
                      disabled={isReviewed}
                      className={`h-6 rounded text-[10px] font-mono uppercase tracking-widest ${isReviewed ? 'bg-background text-foreground border border-border rounded' : 'bg-foreground text-background'}`}
                    >
                      {isReviewed ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</span> : 'Review'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 - Identity and access */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Give every person the access they need — and no more.</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Role-based access</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Project-level access</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Department access</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Restricted projects</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Guest access</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Contractor access</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Temp access expiry</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> SCIM provisioning</div>
              </div>
              <div className="flex flex-wrap gap-3 mt-8">
                <span className="text-[10px] font-mono bg-surface border border-border rounded px-3 py-1 font-bold">SSO</span>
                <span className="text-[10px] font-mono bg-surface border border-border rounded px-3 py-1 font-bold">MFA</span>
                <span className="text-[10px] font-mono bg-surface border border-border rounded px-3 py-1 font-bold">SAML</span>
                <span className="text-[10px] font-mono bg-surface border border-border rounded px-3 py-1 font-bold">OpenID Connect</span>
              </div>
            </div>
            
            <div className="border border-border rounded bg-surface p-6 shadow-xl overflow-x-auto">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                 Role & Permission Matrix
               </div>
               <table className="w-full text-left text-xs font-mono">
                 <thead className="text-muted-foreground">
                   <tr>
                     <th className="pb-3 font-normal">Role</th>
                     <th className="pb-3 font-normal text-center">View</th>
                     <th className="pb-3 font-normal text-center">Edit</th>
                     <th className="pb-3 font-normal text-center">Approve</th>
                     <th className="pb-3 font-normal text-center">Admin</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                   {[
                     { role: 'Project Admin', view: true, edit: true, approve: true, admin: true },
                     { role: 'Engineer', view: true, edit: true, approve: false, admin: false },
                     { role: 'Security Reviewer', view: true, edit: false, approve: true, admin: false },
                     { role: 'Guest / Contractor', view: true, edit: false, approve: false, admin: false }
                   ].map((row, i) => (
                     <tr key={i}>
                       <td className="py-3 font-bold">{row.role}</td>
                       <td className="py-3 text-center">{row.view ? <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-500"/> : '-'}</td>
                       <td className="py-3 text-center">{row.edit ? <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-500"/> : '-'}</td>
                       <td className="py-3 text-center">{row.approve ? <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-500"/> : '-'}</td>
                       <td className="py-3 text-center">{row.admin ? <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-500"/> : '-'}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        </section>

        {/* SECTION 2 - Approval & separation of duties */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-8 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2 flex justify-between">
                 <span>Release Approval Pipeline</span>
                 <span className="text-foreground font-bold">STRICT ENFORCEMENT</span>
               </div>
               
               <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
                 {[
                   { name: 'QA Validation', status: 'approved', user: 'QA Automation', detail: 'All regression tests passed' },
                   { name: 'Security Review', status: 'approved', user: 'E. Rodriguez', detail: 'No critical CVEs found' },
                   { name: 'Compliance Sign-off', status: 'pending', user: 'Required: VP Level', detail: 'Awaiting SOC2 control verification' }
                 ].map((step, i) => (
                   <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                     <div className="flex items-center justify-center w-8 h-8 rounded-full border border-background bg-surface shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                       {step.status === 'approved' ? (
                         <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       ) : (
                         <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                       )}
                     </div>
                     
                     <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] bg-background p-4 border border-border rounded shadow-sm">
                       <div className="flex justify-between items-start mb-1">
                         <div className="text-xs font-bold uppercase tracking-widest font-mono">{step.name}</div>
                         {step.status === 'approved' ? (
                           <span className="text-[8px] font-mono px-1 border border-emerald-500 text-emerald-500 bg-emerald-500/10">APPROVED</span>
                         ) : (
                           <span className="text-[8px] font-mono px-1 border border-accent text-accent bg-accent/10">PENDING</span>
                         )}
                       </div>
                       <div className="text-[10px] text-muted-foreground mt-2">{step.user}</div>
                       <div className="text-[10px] text-muted-foreground mt-1 opacity-80">{step.detail}</div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <GitPullRequest className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Keep critical changes under human control.</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> QA approvals</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Security approvals</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Compliance approvals</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Release approvals</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Multi-step approval chains</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Segregation of duties</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Required reviewer rules</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Auditability */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-6 h-6 text-foreground" />
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Know what changed, who changed it, and why.</h2>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Maintain an immutable record of every critical action. Export logs easily for internal reviews, compliance audits, and incident investigations.
            </p>
          </div>
          
          <div className="border border-border rounded bg-background shadow-xl overflow-x-auto">
            <div className="p-4 bg-surface border-b border-border flex justify-between items-center">
              <span className="font-mono text-xs uppercase tracking-widest font-bold">System Audit Log</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV}
                disabled={exportState !== 'idle'}
                className="h-7 text-[10px] font-mono rounded border-border"
              >
                {exportState === 'idle' ? 'Export CSV' : exportState === 'exporting' ? <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Exporting...</span> : <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3"/> Downloaded</span>}
              </Button>
            </div>
            <table className="w-full text-left text-[10px] font-mono whitespace-nowrap">
              <thead className="bg-surface text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="p-3 font-normal">Timestamp</th>
                  <th className="p-3 font-normal">Actor</th>
                  <th className="p-3 font-normal">Event Type</th>
                  <th className="p-3 font-normal">Resource</th>
                  <th className="p-3 font-normal">Details</th>
                  <th className="p-3 font-normal text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { time: '2026-06-25 14:02:11Z', actor: 'sarah.jenkins', type: 'RELEASE_APPROVED', res: 'Release-2.4.0', det: 'Approved QA gate', ip: '192.168.1.42' },
                  { time: '2026-06-25 13:45:00Z', actor: 'system.bot', type: 'AI_PROMPT_LOGGED', res: 'Project-Aura', det: 'Summarized sprint backlog', ip: '10.0.0.5' },
                  { time: '2026-06-25 11:20:33Z', actor: 'david.lee', type: 'PERMISSION_CHANGED', res: 'Workspace-Settings', det: 'Added Contractor role to j.smith', ip: '172.16.254.1' },
                  { time: '2026-06-25 09:15:22Z', actor: 'elena.rodriguez', type: 'DOC_UPDATED', res: 'Threat-Model-v2', det: 'Updated mitigation steps', ip: '192.168.1.105' },
                  { time: '2026-06-25 08:00:01Z', actor: 'admin.service', type: 'POLICY_ENFORCED', res: 'Org-Global', det: 'MFA requirement verified', ip: '10.0.0.1' },
                ].map((log, i) => (
                  <tr key={i} className="hover:bg-surface-hover">
                    <td className="p-3 text-muted-foreground">{log.time}</td>
                    <td className="p-3 font-bold">{log.actor}</td>
                    <td className="p-3"><span className="border border-border rounded px-1.5 py-0.5 bg-surface">{log.type}</span></td>
                    <td className="p-3">{log.res}</td>
                    <td className="p-3 opacity-80">{log.det}</td>
                    <td className="p-3 text-right text-muted-foreground">{log.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> User activity history</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Permission changes</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> AI usage records</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Release decisions</div>
          </div>
        </section>

        {/* SECTION 4 & 5 - Data Governance & AI Controls */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-border rounded bg-background p-8 lg:p-12">
            <Database className="w-8 h-8 mb-6 text-foreground" />
            <h2 className="text-2xl font-bold tracking-tight mb-4">Keep sensitive work appropriately classified.</h2>
            <div className="flex gap-2 mb-8">
              <span className="text-[10px] font-mono px-2 py-0.5 border border-border rounded bg-surface">PUBLIC</span>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-border rounded bg-surface">INTERNAL</span>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-orange-500 text-orange-500 bg-orange-500/10">CONFIDENTIAL</span>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-destructive text-destructive bg-destructive/10">RESTRICTED</span>
            </div>
            <div className="space-y-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span>Document Access Control</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span>Download Controls</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span>Data Retention Settings</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex justify-between items-center pb-2">
                <span>Workspace Policies</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          </div>
          
          <div className="border border-border rounded bg-surface p-8 lg:p-12 flex flex-col">
            <AiLogo className="w-8 h-8 mb-6 text-accent" />
            <h2 className="text-2xl font-bold tracking-tight mb-4">AI that works within your security model.</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Enable intelligent copilots without exposing classified information or bypassing strict delivery controls.
            </p>
            <div className="space-y-3 font-mono text-xs uppercase tracking-widest text-muted-foreground mt-auto">
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Permission-aware retrieval</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Source citations & Prompt logging</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Data redaction rules</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Restricted-data handling</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Human review rules</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Model provider controls</div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - Security Operations */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <AlertCircle className="w-10 h-10 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Connect delivery risk to security action.</h2>
            <p className="text-muted-foreground text-lg">
              Embed security directly into the software lifecycle, from threat modeling to vulnerability tracking and release gates.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto font-mono text-xs uppercase tracking-widest text-center">
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <FileCode2 className="w-6 h-6 text-muted-foreground" />
              Security review checklists
            </div>
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <Terminal className="w-6 h-6 text-muted-foreground" />
              Vulnerability tracking
            </div>
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <FileText className="w-6 h-6 text-muted-foreground" />
              Threat model documents
            </div>
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <Clock className="w-6 h-6 text-muted-foreground" />
              Incident follow-up
            </div>
          </div>
        </section>

        {/* SECTION 7 - Compliance Workflow Support */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-y border-border py-20 bg-surface">
          <div className="max-w-4xl mx-auto text-center">
            <Fingerprint className="w-10 h-10 mx-auto mb-6 text-muted-foreground opacity-50" />
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">Organize the evidence behind controlled delivery.</h2>
            <div className="flex flex-wrap justify-center gap-3 font-mono text-[10px] uppercase tracking-widest">
              <span className="border border-border rounded bg-background px-4 py-2">Supports compliance workflows</span>
              <span className="border border-border rounded bg-background px-4 py-2">Supports audit evidence collection</span>
              <span className="border border-border rounded bg-background px-4 py-2">Supports review deadlines</span>
              <span className="border border-border rounded bg-background px-4 py-2">Supports approval records</span>
              <span className="border border-border rounded bg-background px-4 py-2">Supports policy documentation</span>
              <span className="border border-border rounded bg-background px-4 py-2">Supports risk registers</span>
            </div>
            <p className="text-xs text-muted-foreground mt-8 opacity-70">
              * HANDOFF provides the workflow and auditing tools necessary to support secure software delivery in highly regulated environments.
            </p>
          </div>
        </section>

        {/* SECTION 8 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            Control delivery without slowing teams down.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/contact', 'security')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              Talk to Security
            </Button>
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              variant="outline"
              className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              Request Demo
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <PublicFooter />

      {/* Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface border border-border rounded p-8 flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
            <Loader2 className="w-8 h-8 text-foreground animate-spin mb-6" />
            <div className="font-mono text-xs uppercase tracking-widest text-center text-muted-foreground">
              {navType === 'signin' ? 'AUTHENTICATING' : 'INITIALIZING WORKSPACE'}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
