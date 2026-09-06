'use client';
import { Logo } from '@/components/logo';
import { MarketingHeader } from '@/components/layout/marketing-header';
import { AiLogo } from '@/components/ai/ai-logo';

import React, { useState } from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/components/layout/public-footer';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Loader2,
  HelpCircle,
  Plus,
  Minus,
  Shield,
  FileText,
  Eye,
  Lock,
  UserCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const PRICING = {
  team: {
    monthly: 15,
    annual: 12
  },
  business: {
    monthly: 35,
    annual: 28
  }
};

// Message keys rather than text: this array is module scope, where the
// useTranslations hook cannot run. Resolved in the component below.
const FAQ_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['canWeStartWithASmallInstitute', 'yesOurTeamPlanIsDesignedForGrowing'],
  ['isCoopsetuAvailableForLargeOrganizations', 'absolutelyCoopsetuIsBuiltSpecificallyToCoord'],
  ['canWeUseSso', 'yesSingleSignOnSsoSamlAndOpenid'],
  ['canWeImportFromExistingLms', 'yesWeOfferDedicatedImportToolsAndScripts'],
  ['doesCoopsetuIntegrateWithStatePortals', 'yesCoopsetuFeaturesDeepIntegrationsWithNcctP'],
  ['canWeControlAiAccess', 'yesOnTheEnterprisePlanCoopsetuAiOperates'],
  ['isEnterpriseOnboardingAvailable', 'yesEnterpriseCustomersReceiveDedicatedOnboar'],
  ['canPricingBeCustomized', 'ourEnterprisePlanOffersCustomPricingBasedOn'],
];

export default function PricingPage() {
  const t = useTranslations('Marketing.pricing');
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navType, setNavType] = React.useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleNavigate = (path: string, type: string) => {
    setNavType(type);
    setIsNavigating(true);
    router.push(path);
  };

  const toggleFaq = (index: number) => {
    if (openFaq === index) {
      setOpenFaq(null);
    } else {
      setOpenFaq(index);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-200">
      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-24">
        {/* HERO SECTION */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-20">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <Logo width={12} height={12} />
              PLANS_AND_PRICING
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              {t('pricingThatScalesWithHowYourInstitutesTrain')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              Start with core batch management. Add enterprise governance, AI career counseling, and state-wide reporting as your needs grow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/contact', 'sales')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('startAConversation')}
              </Button>
              <Button 
                onClick={() => handleNavigate('/contact', 'demo')}
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('requestDemo')}
              </Button>
            </div>
          </div>
        </section>

        {/* PRICING TOGGLE & PLANS */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          {/* Billing Toggle */}
          <div className="flex flex-col items-center justify-center mb-16">
            <div className="flex items-center gap-4 bg-surface border border-border rounded p-1">
              <button 
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${!isAnnual ? 'bg-background border border-border rounded text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t('monthly')}
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${isAnnual ? 'bg-background border border-border rounded text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t('annually')}
              </button>
            </div>
            <div className="mt-4 text-[10px] font-mono text-emerald-500 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" /> Save 20% with annual billing
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Team Plan */}
            <div className="border border-border rounded bg-background p-8 flex flex-col relative">
              <div className="mb-8">
                <h3 className="text-2xl font-bold tracking-tight mb-2">{t('team')}</h3>
                <p className="text-sm text-muted-foreground">{t('growingCooperativeTrainingInstitutes')}</p>
              </div>
              <div className="mb-8">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-bold tracking-tight">${isAnnual ? PRICING.team.annual : PRICING.team.monthly}</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Per user / month{isAnnual ? ', billed annually' : ''}
                </div>
              </div>
              <Button 
                onClick={() => handleNavigate('/signup', 'team')}
                variant="outline" 
                className="w-full rounded border-border h-10 font-mono text-xs uppercase tracking-widest mb-8 hover:bg-surface-hover"
              >
                {t('startWithTeam')}
              </Button>
              <div className="space-y-4 text-sm mt-auto">
                <div className="font-bold text-xs uppercase tracking-widest mb-4 font-mono">{t('features')}</div>
                {[
                  t('batchesAndAssessments'),
                  t('attendanceTracking'),
                  t('basicCoursePlanning'),
                  t('trainerWorkloadView'),
                  t('basicDashboards'),
                  t('forumsAndMaterials'),
                  t('documents'),
                  t('standardLmsIntegrations'),
                  t('basicAiCareerCounselor'),
                  t('emailSupport')
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Plan */}
            <div className="border-2 border-foreground bg-surface p-8 flex flex-col relative shadow-xl transform lg:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-foreground text-background px-4 py-1 text-[10px] font-mono uppercase tracking-widest font-bold">
                {t('mostPopular')}
              </div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold tracking-tight mb-2">{t('business')}</h3>
                <p className="text-sm text-muted-foreground">{t('multiInstituteCooperativeOrganizations')}</p>
              </div>
              <div className="mb-8">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-bold tracking-tight">${isAnnual ? PRICING.business.annual : PRICING.business.monthly}</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Per user / month{isAnnual ? ', billed annually' : ''}
                </div>
              </div>
              <Button 
                onClick={() => handleNavigate('/signup', 'business')}
                className="w-full rounded bg-foreground text-background h-10 font-mono text-xs uppercase tracking-widest mb-8 hover:bg-foreground/90"
              >
                {t('chooseBusiness')}
              </Button>
              <div className="space-y-4 text-sm mt-auto">
                <div className="font-bold text-xs uppercase tracking-widest mb-4 font-mono">Everything in Team, plus:</div>
                {[
                  t('trainingProgramsAndCurriculums'),
                  t('advancedBatchScheduling'),
                  t('infrastructureCapacityPlanning'),
                  t('skillRoadmapsAndPrerequisites'),
                  t('advancedPlacementReporting'),
                  t('assessmentModeration'),
                  t('certificationManagement'),
                  t('paymentGatewayIntegrations'),
                  t('coopsetuAiSkillMatching'),
                  t('scheduledReports'),
                  t('prioritySupport')
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="border border-border rounded bg-background p-8 flex flex-col relative">
              <div className="mb-8">
                <h3 className="text-2xl font-bold tracking-tight mb-2">{t('enterprise')}</h3>
                <p className="text-sm text-muted-foreground">{t('nationalFederationsStateGovernmentsAndLargeC')}</p>
              </div>
              <div className="mb-8">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-bold tracking-tight">{t('custom')}</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  {t('contactUsForAQuote')}
                </div>
              </div>
              <Button 
                onClick={() => handleNavigate('/contact', 'sales')}
                variant="outline" 
                className="w-full rounded border-border h-10 font-mono text-xs uppercase tracking-widest mb-8 hover:bg-surface-hover"
              >
                {t('contactSales')}
              </Button>
              <div className="space-y-4 text-sm mt-auto">
                <div className="font-bold text-xs uppercase tracking-widest mb-4 font-mono">Everything in Business, plus:</div>
                {[
                  t('ssoSamlScimProvisioning'),
                  t('advancedRoleBasedAccessControl'),
                  t('projectLevelRestrictions'),
                  t('approvalWorkflowsGates'),
                  t('securityReviewWorkflows'),
                  t('complianceEvidenceManagement'),
                  t('enterpriseAiControls'),
                  t('aiPromptLogging'),
                  t('dataClassification'),
                  t('dedicatedOnboarding'),
                  t('enterpriseSupportAccountManagement')
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ENTERPRISE AI ADD-ON */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="border border-accent/20 bg-surface shadow-2xl p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-accent uppercase tracking-widest font-bold mb-4">
                  <AiLogo className="w-3 h-3" />
                  {t('coopsetuAddOn')}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{t('aiWithControlsBuiltForEnterpriseWork')}</h2>
                <p className="text-muted-foreground mb-8 text-lg">
                  Empower your teams with generative AI that respects your existing access controls, data boundaries, and compliance requirements.
                </p>
                <Button 
                  onClick={() => handleNavigate('/contact', 'ai')}
                  className="rounded bg-foreground text-background h-10 px-6 font-mono text-xs uppercase tracking-widest"
                >
                  {t('learnAboutEnterpriseAi')}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">{t('permissionAwareAi')}</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">{t('sourceCitations')}</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <Eye className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">{t('promptLogging')}</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">{t('restrictedDataControls')}</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <UserCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">{t('humanApprovalWorkflows')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARE PLANS */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4">{t('comparePlans')}</h2>
            <p className="text-muted-foreground">{t('findTheRightLevelOfControlAndVisibility')}</p>
          </div>
          
          <div className="overflow-x-auto border border-border rounded bg-background shadow-xl">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="p-4 w-1/3 font-bold">{t('features')}</th>
                  <th className="p-4 w-[22%] font-bold text-center">{t('team')}</th>
                  <th className="p-4 w-[22%] font-bold text-center">{t('business')}</th>
                  <th className="p-4 w-[22%] font-bold text-center">{t('enterprise')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Work Management */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('trainingManagement')}</td></tr>
                <tr>
                  <td className="p-4">{t('batchesAndAssessments')}</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('attendanceGradeViews')}</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('customFieldsStatuses')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Digital Training */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('trainingDelivery')}</td></tr>
                <tr>
                  <td className="p-4">{t('coursePlanning')}</td>
                  <td className="p-4 text-center">{t('basic')}</td>
                  <td className="p-4 text-center">{t('advanced')}</td>
                  <td className="p-4 text-center">{t('advanced')}</td>
                </tr>
                <tr>
                  <td className="p-4">{t('capacityPlanning')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Portfolio Management */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('curriculumManagement')}</td></tr>
                <tr>
                  <td className="p-4">{t('programsAndSyllabi')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('roadmapsDependencies')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Portal Integration */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('ecosystemIntegration')}</td></tr>
                <tr>
                  <td className="p-4">{t('moodleBlackboardCanvas')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('certificationTracking')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Security and Compliance */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('securityAndCompliance')}</td></tr>
                <tr>
                  <td className="p-4">{t('roleBasedAccess')}</td>
                  <td className="p-4 text-center">{t('basic')}</td>
                  <td className="p-4 text-center">{t('advanced')}</td>
                  <td className="p-4 text-center">{t('custom')}</td>
                </tr>
                <tr>
                  <td className="p-4">{t('approvalWorkflowsGates')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('auditLogs')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('complianceEvidence')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>

                {/* AI Features */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('aiFeatures')}</td></tr>
                <tr>
                  <td className="p-4">{t('basicSummaries')}</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('planningAnalyticsAi')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('enterpriseAiControls2')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center">{t('addOn')}</td>
                </tr>

                {/* Administration */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('administration')}</td></tr>
                <tr>
                  <td className="p-4">{t('ssoSaml')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">{t('scimProvisioning')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Support */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">{t('support')}</td></tr>
                <tr>
                  <td className="p-4">{t('supportLevel')}</td>
                  <td className="p-4 text-center">{t('email')}</td>
                  <td className="p-4 text-center">{t('priority')}</td>
                  <td className="p-4 text-center">{t('enterprise')}</td>
                </tr>
                <tr>
                  <td className="p-4">{t('dedicatedOnboarding')}</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQs */}
        <section className="px-6 md:px-12 max-w-3xl mx-auto mb-32">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4">{t('frequentlyAskedQuestions')}</h2>
          </div>
          
          <div className="space-y-4">
            {FAQ_KEYS.map((faq, i) => (
              <div key={i} className="border border-border rounded bg-background">
                <button 
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-bold">{t(faq[0])}</span>
                  {openFaq === i ? (
                    <Minus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-muted-foreground text-sm leading-relaxed border-t border-border pt-4">
                    {t(faq[1])}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 8 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16 border-t border-border">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            {t('buildYourTrainingOperatingSystem')}
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
