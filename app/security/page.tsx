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
import { useTranslations } from 'next-intl';

export default function SecurityPage() {
  const t = useTranslations('Marketing.security');
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
      const csvContent = "data:text/csv;charset=utf-8,Timestamp,Actor,EventType,Resource,IPAddress\n2026-06-28T10:00:00Z,admin@CoopSetu.dev,LOGIN,System,192.168.1.1\n";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "CoopSetu_audit_log.csv");
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
              {t('builtForWorkThatRequiresAccountability')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              {t('coopsetuEnterpriseHelpsOrganizationsControlA')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/contact', 'security')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('talkToSecurity')}
              </Button>
              <Button 
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('requestDemo')}
              </Button>
            </div>
          </div>

          {/* Hero Visual - Security Console */}
          <div className="w-full bg-surface-elevated border border-border rounded p-4 shadow-2xl relative overflow-hidden max-w-5xl mx-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
            
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-4">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">{t('workspaceSecurityPolicy')}</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 text-orange-500 bg-orange-500/10 px-2 py-0.5 border border-orange-500/20">
                  <Lock className="w-3 h-3" />
                  {t('restrictedWorkspace')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-4">
                <div className="border border-border rounded bg-background p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{t('identityProvider')}</div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold">{t('ssoEnforced')}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{t('mfaRequired')}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                </div>
                <div className="border border-border rounded bg-background p-4 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{t('recentAuditRecords')}</div>
                  <div className="space-y-2 font-mono text-[10px]">
                    <div className="flex justify-between items-center opacity-70">
                      <span>e.rodriguez modified policy</span>
                      <span>2m ago</span>
                    </div>
                    <div className="flex justify-between items-center opacity-70">
                      <span>s.jenkins approved affiliation</span>
                      <span>15m ago</span>
                    </div>
                    <div className="flex justify-between items-center opacity-70 text-orange-500">
                      <span>{t('failedLoginAttemptIpBlock')}</span>
                      <span>1h ago</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-2 border border-border rounded bg-background p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                  <span>{t('activeAffiliationApprovals')}</span>
                  <span className="text-accent">PIPELINE-24</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-surface p-3 border border-border rounded">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">{t('qaSignOff')}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">Approved by QA_Team</div>
                    </div>
                    <div className="text-[10px] font-mono">10:42 AM</div>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-surface p-3 border border-border rounded">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">{t('securityReview')}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">Approved by Sec_Ops</div>
                    </div>
                    <div className="text-[10px] font-mono">11:15 AM</div>
                  </div>

                  <div className="flex items-center gap-4 bg-background border border-accent/30 p-3 shadow-[0_0_15px_rgba(var(--accent),0.05)]">
                    <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">{t('complianceApproval')}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{t('awaitingDirectorSignOff')}</div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => setIsReviewed(true)}
                      disabled={isReviewed}
                      className={`h-6 rounded text-[10px] font-mono uppercase tracking-widest ${isReviewed ? 'bg-background text-foreground border border-border rounded' : 'bg-foreground text-background'}`}
                    >
                      {isReviewed ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('approved')}</span> : t('review')}
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
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('roleBasedAccess')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('projectLevelAccess')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('departmentAccess')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('restrictedProjects')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('guestAccess')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('contractorAccess')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('tempAccessExpiry')}</div>
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
                 {t('rolePermissionMatrix')}
               </div>
               <table className="w-full text-left text-xs font-mono">
                 <thead className="text-muted-foreground">
                   <tr>
                     <th className="pb-3 font-normal">{t('role')}</th>
                     <th className="pb-3 font-normal text-center">{t('view')}</th>
                     <th className="pb-3 font-normal text-center">{t('edit')}</th>
                     <th className="pb-3 font-normal text-center">{t('approve')}</th>
                     <th className="pb-3 font-normal text-center">{t('admin')}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                   {[
                     { role: t('projectAdmin'), view: true, edit: true, approve: true, admin: true },
                     { role: t('engineer'), view: true, edit: true, approve: false, admin: false },
                     { role: t('securityReviewer'), view: true, edit: false, approve: true, admin: false },
                     { role: t('guestContractor'), view: true, edit: false, approve: false, admin: false }
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
                 <span>{t('affiliationApprovalPipeline')}</span>
                 <span className="text-foreground font-bold">{t('strictEnforcement')}</span>
               </div>
               
               <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
                 {[
                   { name: t('qaValidation'), status: 'approved', user: t('qaAutomation'), detail: t('allRegressionTestsPassed') },
                   { name: t('securityReview'), status: 'approved', user: 'E. Rodriguez', detail: t('noCriticalCvesFound') },
                   { name: t('complianceSignOff'), status: 'pending', user: t('requiredVpLevel'), detail: t('awaitingSoc2ControlVerification') }
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
                           <span className="text-[8px] font-mono px-1 border border-emerald-500 text-emerald-500 bg-emerald-500/10">{t('approved2')}</span>
                         ) : (
                           <span className="text-[8px] font-mono px-1 border border-accent text-accent bg-accent/10">{t('pending')}</span>
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
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('keepCriticalChangesUnderHumanControl')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('qaApprovals')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('securityApprovals')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('complianceApprovals')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('affiliationApprovals')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('multiStepApprovalChains')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('segregationOfDuties')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('requiredReviewerRules')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Auditability */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-6 h-6 text-foreground" />
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('knowWhatChangedWhoChangedItAndWhy')}</h2>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl">
              {t('maintainAnImmutableRecordOfEveryCriticalActi')}
            </p>
          </div>
          
          <div className="border border-border rounded bg-background shadow-xl overflow-x-auto">
            <div className="p-4 bg-surface border-b border-border flex justify-between items-center">
              <span className="font-mono text-xs uppercase tracking-widest font-bold">{t('systemAuditLog')}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV}
                disabled={exportState !== 'idle'}
                className="h-7 text-[10px] font-mono rounded border-border"
              >
                {exportState === 'idle' ? t('exportCsv') : exportState === 'exporting' ? <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> {t('exporting')}</span> : <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3"/> {t('downloaded')}</span>}
              </Button>
            </div>
            <table className="w-full text-left text-[10px] font-mono whitespace-nowrap">
              <thead className="bg-surface text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="p-3 font-normal">{t('timestamp')}</th>
                  <th className="p-3 font-normal">{t('actor')}</th>
                  <th className="p-3 font-normal">{t('eventType')}</th>
                  <th className="p-3 font-normal">{t('resource')}</th>
                  <th className="p-3 font-normal">{t('details')}</th>
                  <th className="p-3 font-normal text-right">{t('ipAddress')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { time: '2026-06-25 14:02:11Z', actor: 'sarah.jenkins', type: 'AFFILIATION_APPROVED', res: 'Affiliation-2026', det: t('approvedInspectionGate'), ip: '192.168.1.42' },
                  { time: '2026-06-25 13:45:00Z', actor: 'system.bot', type: 'AI_PROMPT_LOGGED', res: 'Batch-A', det: t('summarizedBatchAttendance'), ip: '10.0.0.5' },
                  { time: '2026-06-25 11:20:33Z', actor: 'david.lee', type: 'PERMISSION_CHANGED', res: 'Workspace-Settings', det: 'Added Contractor role to j.smith', ip: '172.16.254.1' },
                  { time: '2026-06-25 09:15:22Z', actor: 'elena.rodriguez', type: 'DOC_UPDATED', res: 'Threat-Model-v2', det: t('updatedMitigationSteps'), ip: '192.168.1.105' },
                  { time: '2026-06-25 08:00:01Z', actor: 'admin.service', type: 'POLICY_ENFORCED', res: t('orgGlobal'), det: t('mfaRequirementVerified'), ip: '10.0.0.1' },
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
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> {t('userActivityHistory')}</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> {t('permissionChanges')}</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> {t('aiUsageRecords')}</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> {t('affiliationDecisions')}</div>
          </div>
        </section>

        {/* SECTION 4 & 5 - Data Governance & AI Controls */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-border rounded bg-background p-8 lg:p-12">
            <Database className="w-8 h-8 mb-6 text-foreground" />
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t('keepSensitiveWorkAppropriatelyClassified')}</h2>
            <div className="flex gap-2 mb-8">
              <span className="text-[10px] font-mono px-2 py-0.5 border border-border rounded bg-surface">{t('public')}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-border rounded bg-surface">{t('internal')}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-orange-500 text-orange-500 bg-orange-500/10">{t('confidential')}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-destructive text-destructive bg-destructive/10">{t('restricted')}</span>
            </div>
            <div className="space-y-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span>{t('documentAccessControl')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span>{t('downloadControls')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span>{t('dataRetentionSettings')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex justify-between items-center pb-2">
                <span>{t('workspacePolicies')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          </div>
          
          <div className="border border-border rounded bg-surface p-8 lg:p-12 flex flex-col">
            <AiLogo className="w-8 h-8 mb-6 text-accent" />
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t('aiThatWorksWithinYourSecurityModel')}</h2>
            <p className="text-sm text-muted-foreground mb-8">
              {t('enableIntelligentCopilotsWithoutExposingClas')}
            </p>
            <div className="space-y-3 font-mono text-xs uppercase tracking-widest text-muted-foreground mt-auto">
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('permissionAwareRetrieval')}</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('sourceCitationsPromptLogging')}</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('dataRedactionRules')}</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('restrictedDataHandling')}</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('humanReviewRules')}</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('modelProviderControls')}</div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - Security Operations */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <AlertCircle className="w-10 h-10 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('connectDeliveryRiskToSecurityAction')}</h2>
            <p className="text-muted-foreground text-lg">
              {t('embedSecurityDirectlyIntoTheTrainingLifecycl')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto font-mono text-xs uppercase tracking-widest text-center">
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <FileCode2 className="w-6 h-6 text-muted-foreground" />
              {t('securityReviewChecklists')}
            </div>
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <Terminal className="w-6 h-6 text-muted-foreground" />
              {t('vulnerabilityTracking')}
            </div>
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <FileText className="w-6 h-6 text-muted-foreground" />
              {t('threatModelDocuments')}
            </div>
            <div className="border border-border rounded bg-surface p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors cursor-default">
              <Clock className="w-6 h-6 text-muted-foreground" />
              {t('incidentFollowUp')}
            </div>
          </div>
        </section>

        {/* SECTION 7 - Compliance Workflow Support */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-y border-border py-20 bg-surface">
          <div className="max-w-4xl mx-auto text-center">
            <Fingerprint className="w-10 h-10 mx-auto mb-6 text-muted-foreground opacity-50" />
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">{t('organizeTheEvidenceBehindControlledDelivery')}</h2>
            <div className="flex flex-wrap justify-center gap-3 font-mono text-[10px] uppercase tracking-widest">
              <span className="border border-border rounded bg-background px-4 py-2">{t('supportsComplianceWorkflows')}</span>
              <span className="border border-border rounded bg-background px-4 py-2">{t('supportsAuditEvidenceCollection')}</span>
              <span className="border border-border rounded bg-background px-4 py-2">{t('supportsReviewDeadlines')}</span>
              <span className="border border-border rounded bg-background px-4 py-2">{t('supportsApprovalRecords')}</span>
              <span className="border border-border rounded bg-background px-4 py-2">{t('supportsPolicyDocumentation')}</span>
              <span className="border border-border rounded bg-background px-4 py-2">{t('supportsRiskRegisters')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-8 opacity-70">
              * CoopSetu provides the workflow and auditing tools necessary to support secure software delivery in highly regulated environments.
            </p>
          </div>
        </section>

        {/* SECTION 8 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            {t('controlDeliveryWithoutSlowingTeamsDown')}
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/contact', 'security')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('talkToSecurity')}
            </Button>
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              variant="outline"
              className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('requestDemo')}
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
              {navType === 'signin' ? t('authenticating') : t('initializingWorkspace')}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
