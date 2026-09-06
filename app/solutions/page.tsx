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
  BarChart3, 
  CheckCircle2, 
  GitPullRequest, 
  Layers, 
  Lock, 
  Shield, 
  Terminal, 
  Activity, 
  Cpu, 
  Loader2,
  Menu,
  X,
  ChevronRight,
  Database,
  Globe,
  Settings,
  Users,
  Briefcase,
  AlertCircle,
  Eye,
  FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function SolutionsPage() {
  const t = useTranslations('Marketing.solutions');
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navType, setNavType] = React.useState<string | null>(null);
  
  // Mock feature state
  const [isApproved, setIsApproved] = React.useState(false);

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
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              SOLUTIONS_BY_ROLE
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              {t('builtForEveryStakeholderResponsibleForCooper')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              {t('fromCurriculumPlanningToFinalPlacementCoopse')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/product', 'explore')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('exploreSolutions')}
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

        {/* SECTION 1 - Engineering Leadership */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('giveNcctLeadersARealTimeViewOf')}</h2>
              </div>
              <p className="text-muted-foreground mb-8 text-lg">
                {t('stopGuessingAboutBatchSchedulesAndInstituteC')}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> {t('noBatchVisibility')}</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> {t('unclearInstituteCapacity')}</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> {t('delayedCertifications')}</div>
                <div className="flex items-center gap-3 text-muted-foreground"><X className="w-4 h-4 text-orange-500" /> {t('disconnectedAssessmentTools')}</div>
              </div>

              <div className="space-y-4 font-mono text-sm uppercase tracking-widest">
                <div className="text-[10px] text-accent font-bold mb-4">{t('coopsetuSolution')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('nationalDashboards')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('instituteHealthScoring')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('crossInstituteBenchmarking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('coopsetuAiPlacementSummaries')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-4 relative shadow-xl">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-surface-hover rounded-tr-[100px] pointer-events-none -z-10" />
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>{t('nationalPortfolio')}</span>
                <span>Q3 Placements</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-surface p-4 border border-border rounded">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">{t('totalTrainees')}</div>
                  <div className="text-2xl font-bold">12,400</div>
                </div>
                <div className="bg-surface p-4 border border-border rounded">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">{t('institutesAtRisk')}</div>
                  <div className="text-2xl font-bold text-orange-500">3</div>
                </div>
              </div>
              <div className="bg-surface p-4 border border-border rounded">
                 <div className="text-[10px] uppercase text-muted-foreground mb-3 font-bold">{t('strategicPrograms')}</div>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center border-b border-border pb-2">
                     <span className="text-xs font-bold">{t('ruralBankingDiploma')}</span>
                     <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 border border-emerald-500">{t('healthy')}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold">{t('agriTechCertification')}</span>
                     <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 border border-orange-500">{t('atRisk')}</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 - Institute Admins */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                {t('curriculumBatches')}
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4 flex gap-4 items-center">
                   <div className="w-8 h-8 bg-surface border border-border rounded flex items-center justify-center font-bold">Q3</div>
                   <div className="flex-1">
                     <div className="text-sm font-bold mb-1">{t('newBankingModule')}</div>
                     <div className="w-full h-1.5 bg-surface border border-border rounded"><div className="h-full bg-foreground w-[40%]" /></div>
                   </div>
                 </div>
                 <div className="pl-12 space-y-2">
                    <div className="bg-background border border-border rounded p-3 flex justify-between items-center text-xs">
                      <span>{t('scheduleGuestLectures')}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{t('inProgress')}</span>
                    </div>
                    <div className="bg-background border border-border rounded p-3 flex justify-between items-center text-xs">
                      <span>{t('finalizeAssessmentPapers')}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{t('backlog')}</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Briefcase className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('turnCurriculumIntoClearAccountableTraining')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('syllabiBatches')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('modulesAndSessions')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('batchScheduling')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('assessmentTracking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('aiQuestionGeneration')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - Trainers */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('manageTraineePerformanceBeforeAssessments')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('traineeAttendanceGrades')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('competencyMapping')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('interventionRecommendations')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('dropoutRiskDetection')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('learningGapIdentification')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-6 border-b border-border pb-2 flex justify-between">
                <span>{t('traineePerformance')}</span>
                <span>Batch A</span>
              </div>
              <div className="space-y-6">
                 {['S. Jenkins', 'A. Moore', 'P. Patel'].map((name, i) => {
                   const workload = [95, 115, 60][i];
                   const isOver = workload > 100;
                   return (
                     <div key={name}>
                       <div className="flex justify-between text-xs font-bold mb-2">
                         <span>{name}</span>
                         <span className={`font-mono ${isOver ? 'text-orange-500' : ''}`}>{workload}%</span>
                       </div>
                       <div className="h-2 w-full bg-surface border border-border rounded">
                         <div className={`h-full ${isOver ? 'bg-orange-500' : 'bg-foreground'}`} style={{ width: `${Math.min(workload, 100)}%` }} />
                       </div>
                     </div>
                   );
                 })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - Trainees */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
                {t('traineeWorkspace')}
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4">
                   <div className="flex justify-between items-start mb-4">
                     <div className="text-sm font-bold">{t('completeModule4Assignment')}</div>
                     <span className="text-[10px] font-mono border border-border rounded px-2 py-0.5 bg-surface">{t('inProgress')}</span>
                   </div>
                   <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground mt-4 pt-4 border-t border-border">
                     <span className="flex items-center gap-1"><GitPullRequest className="w-3 h-3" /> {t('assignmentSubmitted')}</span>
                     <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> Auto-graded: 85%</span>
                   </div>
                 </div>
                 
                 <div className="border border-accent/30 bg-accent/5 p-3 flex gap-3">
                   <AiLogo className="w-4 h-4 text-accent flex-shrink-0" />
                   <div>
                     <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-1">{t('coopsetuSummary')}</div>
                     <p className="text-[10px] leading-relaxed text-muted-foreground">{t('goodWorkOnTheAssignmentMakeSureTo')}</p>
                   </div>
                 </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Terminal className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('keepSchedulesLearningAssessmentsAndCertifica')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('myLearningDashboard')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('linkedCourseMaterials')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('liveAttendanceTracking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('assignmentFeedback')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('aiStudySummaries')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 - Assessors */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('makeSkillsVisibleBeforePlacement')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('assessmentPlansRubrics')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('gradeFeedbackTracking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('moderationWorkflows')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('certificationReadinessChecks')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('aiGeneratedQuestionBanks')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>Assessment: Batch A Final</span>
                <span className="text-orange-500 font-bold">1 PENDING</span>
              </div>
              <div className="space-y-3">
                 <div className="bg-surface border border-border rounded p-3 flex items-center justify-between">
                   <span className="text-xs font-bold">{t('theorySection')}</span>
                   <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500 px-2 bg-emerald-500/10">{t('passed')}</span>
                 </div>
                 <div className="bg-surface border border-border rounded p-3 flex items-center justify-between">
                   <span className="text-xs font-bold">{t('practicalViva')}</span>
                   <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500 px-2 bg-emerald-500/10">{t('passed')}</span>
                 </div>
                 <div className="bg-background border border-orange-500 p-3 flex flex-col gap-2">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold">{t('projectSubmission')}</span>
                     <span className="text-[10px] font-mono text-orange-500 border border-orange-500 px-2 bg-orange-500/10">{t('needsReview')}</span>
                   </div>
                   <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {t('plagiarismScoreAboveThreshold')}</div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - State Registries & NCCT */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>{t('affiliationReviewGate')}</span>
                <span className="text-accent font-bold">{t('pending')}</span>
              </div>
              <div className="space-y-4">
                 <div className="bg-background border border-border rounded p-4">
                   <div className="text-sm font-bold mb-3">{t('instituteRenewalRequirements')}</div>
                   <div className="space-y-2">
                     <div className="flex items-center gap-3 text-xs">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('infrastructureAuditPassed')}
                     </div>
                     <div className="flex items-center gap-3 text-xs">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('facultyRatioVerified')}
                     </div>
                     <div className="flex items-center gap-3 text-xs">
                       <div className="w-4 h-4 border border-border rounded bg-surface" /> {t('manualInspectionSignoffRequired')}
                     </div>
                   </div>
                 </div>
                 <Button 
                   onClick={() => setIsApproved(true)}
                   disabled={isApproved}
                   className={`w-full h-8 rounded font-mono text-[10px] uppercase tracking-widest ${isApproved ? 'bg-background text-foreground border border-border rounded' : 'bg-foreground text-background'}`}
                 >
                   {isApproved ? <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t('approved')}</span> : t('approveSign')}
                 </Button>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('buildAffiliationAndComplianceIntoTheEcosyste')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('affiliationReviewWorkflows')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('grievanceManagement')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('inspectionGatesAuditLogs')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('complianceEvidenceCollection')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7 - Placement Partners */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Layers className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('connectTrainingOutcomesToIndustryReality')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('placementPipelineVisibility')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('employerTracking')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('jobOfferApprovals')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('interviewSchedulingWorkflows')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {t('skillPassports')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-background p-6 shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                <span>{t('placements')}</span>
                <span>{t('hired')}</span>
              </div>
              <div className="space-y-3">
                 <div className="bg-surface border border-border rounded p-3">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold">{t('seniorAnalystRole')}</span>
                     <span className="text-[10px] font-mono text-emerald-500">{t('offerAccepted')}</span>
                   </div>
                   <div className="text-[10px] font-mono text-muted-foreground flex gap-4">
                     <span>{t('accepted2hAgo')}</span>
                     <span>Candidate: S. Jenkins</span>
                   </div>
                 </div>
                 <div className="bg-background border border-border rounded p-3 opacity-70">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold">{t('branchManagerRole')}</span>
                     <span className="text-[10px] font-mono text-muted-foreground">{t('rejected')}</span>
                   </div>
                   <div className="text-[10px] font-mono text-muted-foreground flex gap-4">
                     <span>{t('interviewedYesterday')}</span>
                     <span>Candidate: System</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8 - National Cooperatives */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="bg-surface border border-border rounded p-8 lg:p-16 text-center max-w-5xl mx-auto shadow-2xl">
            <Lock className="w-12 h-12 mx-auto mb-6 text-foreground" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('controlTrainingWhereAccountabilityMatters')}</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
              {t('designedForNationalFederationsCoopsetuSuppor')}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs uppercase tracking-widest text-foreground text-left">
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                {t('segregationOfDuties')}
              </div>
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <GitPullRequest className="w-5 h-5 text-muted-foreground" />
                {t('approvalChains')}
              </div>
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <Database className="w-5 h-5 text-muted-foreground" />
                {t('immutableAuditLogs')}
              </div>
              <div className="border border-border rounded bg-background p-4 flex flex-col items-center text-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                {t('releaseEvidence')}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 9 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16 border-t border-border">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            {t('onePlatformEveryStakeholderClearAccountabili')}
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('requestDemo')}
            </Button>
            <Button 
              onClick={() => handleNavigate('/contact', 'sales')}
              variant="outline"
              className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('contactSales')}
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
