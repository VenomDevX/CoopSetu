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
  Loader2,
  Building2,
  BarChart3,
  Network,
  Workflow,
  Blocks,
  Settings2,
  PieChart,
  Terminal,
  Shield,
  Activity,
  GitPullRequest,
  Database,
  ArrowDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function EnterprisePage() {
  const t = useTranslations('Marketing.enterprise');
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navType, setNavType] = React.useState<string | null>(null);

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
              <Building2 className="w-4 h-4" />
              ENTERPRISE_OPERATIONS
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              {t('coordinateCooperativeTrainingAcrossTheEntire')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              {t('coopsetuGivesNationalFederationsAControlledS')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/contact', 'sales')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('contactSales')}
              </Button>
              <Button 
                onClick={() => handleNavigate('/product', 'explore')}
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('explorePlatform')}
              </Button>
            </div>
          </div>

          {/* Hero Visual - Enterprise Command Center */}
          <div className="w-full bg-surface-elevated border border-border rounded p-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-foreground to-transparent opacity-50" />
            
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-4">
                <Building2 className="w-4 h-4 text-foreground" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">{t('nationalTrainingCommand')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">{t('updatedJustNow')}</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Left Column: Portfolio & AI */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="border border-border rounded bg-background p-4 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{t('programHealth')}</div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span>{t('retailBanking')}</span>
                      <span className="text-emerald-500 font-mono">92%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>Agri-Tech</span>
                      <span className="text-orange-500 font-mono">74%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>{t('cybersecurity')}</span>
                      <span className="text-emerald-500 font-mono">98%</span>
                    </div>
                  </div>
                </div>
                
                <div className="border border-accent/20 bg-surface p-4 flex-1 shadow-[0_0_15px_rgba(var(--accent),0.05)]">
                  <div className="flex items-center gap-2 mb-2">
                    <AiLogo className="w-3 h-3 text-accent" />
                    <span className="font-mono text-[10px] uppercase tracking-widest font-bold">{t('executiveSummary')}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {t('overallDeliveryVelocityIsStableAt2450')}
                  </p>
                </div>
              </div>

              {/* Middle Column: Programs & Dependencies */}
              <div className="lg:col-span-2 border border-border rounded bg-background p-4 flex flex-col">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">{t('activeProgramsAffiliations')}</div>
                <div className="flex-1 space-y-4">
                   <div className="bg-surface border border-border rounded p-3">
                     <div className="flex justify-between mb-2">
                       <span className="text-xs font-bold uppercase">{t('q3RuralExpansion')}</span>
                       <span className="text-[10px] font-mono bg-orange-500/10 text-orange-500 border border-orange-500 px-1">{t('atRisk')}</span>
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                       <Network className="w-3 h-3" />
                       {t('blockedByStateRegistrationCompliance')}
                     </div>
                   </div>
                   
                   <div className="bg-surface border border-border rounded p-3">
                     <div className="flex justify-between mb-2">
                       <span className="text-xs font-bold uppercase">{t('unifiedLmsRollout')}</span>
                       <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500 px-1">{t('onTrack')}</span>
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                       <Network className="w-3 h-3" />
                       {t('dependenciesResolvedAssessorAvailability')}
                     </div>
                   </div>
                </div>
              </div>

              {/* Right Column: Capacity & Placement Pipeline */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="border border-border rounded bg-background p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{t('nationalCapacity')}</div>
                  <div className="text-2xl font-bold font-mono">94%</div>
                  <div className="w-full h-1 bg-surface mt-2 border border-border rounded overflow-hidden">
                    <div className="h-full bg-foreground w-[94%]" />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 uppercase">12 Institutes Overallocated</div>
                </div>

                <div className="border border-border rounded bg-background p-4 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{t('placementPipeline')}</div>
                  <div className="space-y-2 text-[10px] font-mono">
                     <div className="flex justify-between items-center bg-surface p-1.5 border border-border rounded">
                       <span>{t('seniorAnalyst')}</span>
                       <span className="text-emerald-500">{t('hired')}</span>
                     </div>
                     <div className="flex justify-between items-center bg-surface p-1.5 border border-border rounded">
                       <span>{t('branchManager')}</span>
                       <span className="text-orange-500">{t('interviewing')}</span>
                     </div>
                     <div className="flex justify-between items-center bg-surface p-1.5 border border-border rounded">
                       <span>{t('loanOfficer')}</span>
                       <span className="text-muted-foreground">{t('sourcing')}</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 - Built for organizational complexity */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Network className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('fromOneInstituteToHundredsOfTrainingInstitut')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('nationalFederations')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('stateChapters')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('districts')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Institutes</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('programsCurriculums')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('batches')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('crossInstituteBenchmarking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('nationalRoadmaps')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-surface p-8 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2">
                 {t('structuralHierarchy')}
               </div>
               
               <div className="flex flex-col gap-1 items-center">
                 {[t('federation'), t('state'), t('district'), t('institute'), t('program'), t('course'), t('batch')].map((level, i, arr) => (
                   <React.Fragment key={level}>
                     <div className="w-full max-w-[200px] border border-border rounded bg-background p-3 text-center text-xs font-bold font-mono uppercase tracking-widest shadow-sm">
                       {level}
                     </div>
                     {i < arr.length - 1 && (
                       <ArrowDown className="w-4 h-4 text-muted-foreground my-1 opacity-50" />
                     )}
                   </React.Fragment>
                 ))}
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 - Portfolio & Program Control */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-8 shadow-xl relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                {t('programAffiliationMap')}
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4 relative">
                   <div className="text-xs font-bold mb-1">{t('ruralBankingDiploma')}</div>
                   <div className="text-[10px] font-mono text-muted-foreground mb-2">{t('ncctPilot')}</div>
                   <div className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 border border-orange-500 inline-block">{t('blockedByAudit')}</div>
                 </div>
                 
                 <div className="flex justify-center">
                   <ArrowDown className="w-4 h-4 text-muted-foreground" />
                 </div>
                 
                 <div className="bg-background border border-border rounded p-4">
                   <div className="text-xs font-bold mb-1">{t('infrastructureAudit')}</div>
                   <div className="text-[10px] font-mono text-muted-foreground mb-2">{t('complianceTeam')}</div>
                   <div className="w-full h-1.5 bg-surface border border-border rounded">
                     <div className="h-full bg-foreground w-[85%]" />
                   </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('seeHowEveryBatchContributesToTheNational')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('nationalDashboards')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('programManagement')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('instituteHealth')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('budgetAndPlacementVisibility')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('riskCertificationTracking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('crossInstituteBenchmarking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('placementForecasting')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Enterprise Workflow Governance */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Workflow className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('standardizeTrainingWithoutForcingEveryInstit')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('batchTemplates')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('curriculumTemplates')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('moderationTemplates')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('customStatusesFields')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('customRoles')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('customDashboards')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('stateSpecificWorkflows')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('certificationGates')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>{t('workflowConfiguration')}</span>
                <span>{t('agriTechProgram')}</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {[t('enrollment'), t('theory'), t('practical'), t('evaluation'), t('moderation'), t('placement')].map((status, i) => (
                  <div key={i} className="bg-surface border border-border rounded px-3 py-1 text-xs font-mono">
                    {status}
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-xs font-bold mb-2">{t('requiredFields')}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-mono"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t('minimumAttendanceTarget')}</div>
                  <div className="flex items-center gap-2 text-[10px] font-mono"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t('assessorIdentityProof')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - Enterprise Integrations */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Blocks className="w-10 h-10 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('connectCoopsetuToThePortalsYourFederationAlr')}</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { category: t('identityRegistries'), tools: ['Skill India', 'e-Shram', 'UIDAI'] },
              { category: t('lmsContent'), tools: ['Moodle', 'Canvas', 'Blackboard'] },
              { category: t('paymentGateways'), tools: ['Razorpay', 'BillDesk', 'CCAvenue'] },
              { category: t('communications'), tools: ['WhatsApp', 'SMS', t('email')] },
              { category: t('statePortals'), tools: ['NCCT', 'VAMNICOM', 'PACS'] },
              { category: t('identity'), tools: ['Okta', 'Azure AD', 'OneLogin'] },
              { category: t('migrations'), tools: [t('moodleImport'), t('customLmsImport'), t('csvImport')] },
              { category: 'Custom API', tools: ['REST API', 'Webhooks', 'GraphQL'] },
            ].map((block, i) => (
              <div key={i} className="border border-border rounded bg-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{block.category}</div>
                <div className="space-y-2 text-xs font-bold">
                  {block.tools.map((tool, j) => (
                    <div key={j}>{tool}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5 - Administration at Scale */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-8 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2">
                 {t('organizationSettings')}
               </div>
               <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4 flex justify-between items-center">
                   <div>
                     <div className="text-sm font-bold">{t('samlSingleSignOn')}</div>
                     <div className="text-xs text-muted-foreground">{t('enforceIdentityProviderLogin')}</div>
                   </div>
                   <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                     <div className="absolute right-1 top-1 bg-background w-3 h-3 rounded-full" />
                   </div>
                 </div>
                 <div className="bg-background border border-border rounded p-4 flex justify-between items-center">
                   <div>
                     <div className="text-sm font-bold">{t('aiDataPrivacy')}</div>
                     <div className="text-xs text-muted-foreground">{t('optOutOfModelTraining')}</div>
                   </div>
                   <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                     <div className="absolute right-1 top-1 bg-background w-3 h-3 rounded-full" />
                   </div>
                 </div>
                 <div className="bg-background border border-border rounded p-4 flex justify-between items-center">
                   <div>
                     <div className="text-sm font-bold">{t('scimUserProvisioning')}</div>
                     <div className="text-xs text-muted-foreground">{t('automateAccountCreation')}</div>
                   </div>
                   <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                     <div className="absolute right-1 top-1 bg-background w-3 h-3 rounded-full" />
                   </div>
                 </div>
               </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Settings2 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('manageAccessInstitutesAndPolicyFromOnePlace')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('ssoScim')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('roleManagement')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('stateAdmin')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('instituteProvisioning')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('batchAccessPolicies')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('auditLogs')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('securitySettings')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('aiDataRetention')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - Enterprise Reporting */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <PieChart className="w-10 h-10 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('giveEveryStakeholderTheRightLevelOfVisibilit')}</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
             <div className="border border-border rounded bg-surface p-6">
               <div className="font-bold mb-4 border-b border-border pb-2">{t('forLeadershipNcctDirectors')}</div>
               <ul className="space-y-2 text-sm text-muted-foreground">
                 <li>• National dashboards</li>
                 <li>• Placement health reports</li>
                 <li>• Nation-wide certification rate</li>
               </ul>
             </div>
             <div className="border border-border rounded bg-surface p-6">
               <div className="font-bold mb-4 border-b border-border pb-2">{t('forInstituteDirectors')}</div>
               <ul className="space-y-2 text-sm text-muted-foreground">
                 <li>• Scheduled reports</li>
                 <li>• Capacity & utilization reports</li>
                 <li>• Cross-batch benchmarking</li>
               </ul>
             </div>
             <div className="border border-border rounded bg-surface p-6">
               <div className="font-bold mb-4 border-b border-border pb-2">{t('forAssessorsCompliance')}</div>
               <ul className="space-y-2 text-sm text-muted-foreground">
                 <li>• Exportable PDFs</li>
                 <li>• Trainee transcripts</li>
                 <li>• Affiliation & Audit reports</li>
               </ul>
             </div>
          </div>
        </section>

        {/* SECTION 7 - Implementation Process */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-y border-border py-20 bg-surface">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-background border border-border rounded flex items-center justify-center font-mono font-bold mx-auto mb-4">1</div>
              <h3 className="font-bold text-lg mb-2">{t('connect')}</h3>
              <p className="text-sm text-muted-foreground">{t('connectInstitutesTraineesPortalsAndWorkspace')}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-background border border-border rounded flex items-center justify-center font-mono font-bold mx-auto mb-4">2</div>
              <h3 className="font-bold text-lg mb-2">{t('configure')}</h3>
              <p className="text-sm text-muted-foreground">{t('setRolesCurriculumsAssessmentRulesBatchTempl')}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center font-mono font-bold mx-auto mb-4">3</div>
              <h3 className="font-bold text-lg mb-2">{t('operate')}</h3>
              <p className="text-sm text-muted-foreground">{t('runEnrollmentTrainingAssessmentsPlacementsAn')}</p>
            </div>
          </div>
        </section>

        {/* SECTION 8 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            {t('bringEveryTrainingFunctionIntoOneOperatingSy')}
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/contact', 'sales')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('contactSales')}
            </Button>
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              variant="outline"
              className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('requestEnterpriseDemo')}
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
