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
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function AIPage() {
  const t = useTranslations('Marketing.ai');
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navType, setNavType] = React.useState<string | null>(null);
  
  // Mock feature states
  const [chatInput, setChatInput] = React.useState('');
  const [isChatting, setIsChatting] = React.useState(false);
  const [chatResponse, setChatResponse] = React.useState<string | null>(null);
  
  const [convertState, setConvertState] = React.useState<'idle'|'converting'|'done'>('idle');

  const handleSendChat = (prompt?: string) => {
    if (!prompt && !chatInput) return;
    setIsChatting(true);
    setChatInput(prompt || chatInput);
    setChatResponse(null);
    setTimeout(() => {
      setChatResponse("Based on the data, the project is on track but requires API specifications before Friday to prevent delays.");
      setIsChatting(false);
      setChatInput('');
    }, 1500);
  };

  const handleConvertToTasks = () => {
    setConvertState('converting');
    setTimeout(() => {
      setConvertState('done');
      setTimeout(() => setConvertState('idle'), 3000);
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
            <div className="font-mono text-xs uppercase tracking-widest text-accent mb-6 flex items-center gap-2">
              <AiLogo className="w-4 h-4" />
              CoopSetu_AI
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              AI that understands delivery work — without bypassing control.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              {t('coopsetuAiHelpsTeamsPlanPrioritizeSummarizeI')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/product', 'explore')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('exploreCoopsetuAi')}
              </Button>
              <Button 
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                {t('requestDemo')}
              </Button>
            </div>
          </div>

          {/* Hero Visual - AI Command Console */}
          <div className="w-full bg-surface-elevated border border-border rounded p-4 shadow-2xl relative overflow-hidden max-w-5xl mx-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
            
            {/* Console Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-4">
                <AiLogo className="w-4 h-4 text-accent" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">{t('coopsetuIntelligenceConsole')}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                  <Shield className="w-3 h-3" />
                  {t('strictIamEnforced')}
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-border" />
                  <div className="w-2 h-2 rounded-full bg-border" />
                  <div className="w-2 h-2 rounded-full bg-border" />
                </div>
              </div>
            </div>

            {/* AI Interaction Area */}
            <div className="flex flex-col gap-4">
              {/* User Prompt */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center font-bold text-xs flex-shrink-0">
                  U
                </div>
                <div className="bg-background border border-border rounded p-4 text-sm font-mono flex-1 relative">
                  {t('whyIsThePaymentsApiReleaseDelayed')}
                </div>
              </div>

              {/* AI Answer */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-accent/20 text-accent border border-accent/50 flex items-center justify-center flex-shrink-0">
                  <AiLogo className="w-4 h-4" />
                </div>
                <div className="bg-surface border border-accent/20 p-4 text-sm flex-1 relative shadow-[0_0_15px_rgba(var(--accent),0.05)]">
                  <p className="mb-4 leading-relaxed">
                    {t('release380IsDelayedByTwo')}
                  </p>
                  
                  {/* Source Citations */}
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{t('verifiedSources')}</div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-xs bg-background border border-border rounded px-2 py-1">
                        <Terminal className="w-3 h-3 text-muted-foreground" />
                        <span>PAY-1042 (Blocked)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs bg-background border border-border rounded px-2 py-1">
                        <AlertCircle className="w-3 h-3 text-orange-500" />
                        <span>Regression Test Suite #45</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs bg-background border border-border rounded px-2 py-1">
                        <Shield className="w-3 h-3 text-accent" />
                        <span>{t('securityReviewGatePending')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer metadata */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-border text-[10px] font-mono text-muted-foreground">
                     <span className="flex items-center gap-1.5">
                       <Lock className="w-3 h-3" />
                       Audit Log Ref: a8f9-2b4c
                     </span>
                     <span>{t('responseGeneratedIn12s')}</span>
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="mt-4 border border-border rounded bg-background flex items-center p-2 relative">
                <Search className="w-4 h-4 text-muted-foreground ml-2" />
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === t('enter') && handleSendChat()}
                  placeholder="Ask CoopSetu..." 
                  className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-3 font-mono"
                  disabled={isChatting}
                />
                <Button 
                  onClick={() => handleSendChat()}
                  disabled={isChatting || !chatInput}
                  className="h-8 rounded bg-foreground text-background font-mono text-[10px] uppercase tracking-widest px-4"
                >
                  {isChatting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Send'}
                </Button>
                {chatResponse && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-border rounded p-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-[10px] uppercase text-accent font-bold">{t('aiResponse')}</span>
                      <button onClick={() => setChatResponse(null)}><X className="w-3 h-3 text-muted-foreground hover:text-foreground"/></button>
                    </div>
                    {chatResponse}
                  </div>
                )}
              </div>
              
              {/* Suggested Prompts */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-2">
                <span onClick={() => handleSendChat(t('summarizeSprint14'))} className="text-[10px] font-mono uppercase text-muted-foreground px-3 py-1 border border-border rounded bg-surface whitespace-nowrap cursor-pointer hover:bg-surface-hover transition-colors">{t('summarizeSprint14')}</span>
                <span onClick={() => handleSendChat(t('projectRisksThisWeek'))} className="text-[10px] font-mono uppercase text-muted-foreground px-3 py-1 border border-border rounded bg-surface whitespace-nowrap cursor-pointer hover:bg-surface-hover transition-colors">{t('projectRisksThisWeek')}</span>
                <span onClick={() => handleSendChat(t('draftPrdForNewBilling'))} className="text-[10px] font-mono uppercase text-muted-foreground px-3 py-1 border border-border rounded bg-surface whitespace-nowrap cursor-pointer hover:bg-surface-hover transition-colors">{t('draftPrdForNewBilling')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 - AI for planning */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('turnAProjectBriefIntoADeliveryPlan')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('generateProjectPlans')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('breakRequirementsIntoEpics')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('generateFeaturesAndTasks')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('createSubtasksAcceptanceCriteria')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('suggestMilestonesEstimatePoints')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('identifyMissingDependencies')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('suggestStaffingNeeds')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-surface p-6 shadow-xl relative">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                 <span>{t('coopsetuGeneration')}</span>
                 <AiLogo className="w-3 h-3 text-accent" />
               </div>
               <div className="bg-background border border-border rounded p-4">
                 <div className="text-xs font-bold mb-4">Epic: Migrate to OAuth 2.0</div>
                 <div className="space-y-2">
                   {['Update login UI to support social providers', 'Implement backend token exchange route', 'Add PKCE support for mobile clients'].map((task, i) => (
                     <div key={i} className="flex gap-3 items-center border border-border rounded p-2 bg-surface">
                       <div className="w-4 h-4 border border-border rounded flex-shrink-0" />
                       <div className="text-xs flex-1">{task}</div>
                       <div className="text-[10px] font-mono bg-background border border-border rounded px-1">5 pts</div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 - AI for daily execution */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                 <span>{t('dailyStandupDigest')}</span>
                 <AiLogo className="w-3 h-3 text-accent" />
               </div>
               <div className="bg-background border border-border rounded p-4 text-sm leading-relaxed border-l-2 border-l-accent">
                 <p className="mb-4">{t('youHave3HighPriorityTasksDueToday')} <span className="font-bold">Task #842</span> {t('isBlockedByAMissingApiSpecification')} <span className="font-bold">Task #845</span> {t('has4NewCommentsDiscussingArchitectureChanges')}</p>
                 <p className="text-muted-foreground">Recommendation: Reassign Task #845 to S. Jenkins to balance your workload, as you are currently at 110% capacity.</p>
               </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('helpEveryEmployeeFocusOnTheRightWork')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('prioritizeTasks')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('createDailyStandUpSummaries')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('explainBlockersDetectConflicts')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('summarizeTaskComments')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('recommendNextAction')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('detectWorkloadOverload')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('suggestReassignment')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 - AI for training operations */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <FileCode2 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('makeTechnicalActivityVisibleBeyondCode')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('summarizePullRequests')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('explainCodeChangesInPlainLanguage')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('suggestReviewers')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('summarizeCiCdFailures')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('detectRiskyDeployments')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('generateReleaseNotes')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('linkCodeChangesToProjectWork')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-surface p-6 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                 <span>{t('prSummary')}</span>
                 <AiLogo className="w-3 h-3 text-accent" />
               </div>
               <div className="bg-background border border-border rounded p-4 mb-4">
                 <div className="flex items-center gap-2 mb-2">
                   <GitPullRequest className="w-4 h-4 text-emerald-500" />
                   <span className="text-sm font-bold">Fix race condition in checkout</span>
                 </div>
                 <p className="text-xs text-muted-foreground mb-4 border-l-2 border-accent pl-3">
                   This PR introduces a distributed lock using Redis to prevent concurrent modification of cart totals during checkout. It addresses Bug #1042.
                 </p>
                 <div className="flex gap-2">
                   <span className="text-[10px] font-mono bg-surface border border-border rounded px-2 py-1">Reviewers suggested: E. Rodriguez, A. Moore</span>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - AI for documentation */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 border border-border rounded bg-surface p-6 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                 <span>{t('documentAnalysis')}</span>
                 <AiLogo className="w-3 h-3 text-accent" />
               </div>
               <div className="bg-background border border-border rounded p-4 mb-2 flex items-center gap-3">
                 <FileText className="w-5 h-5 text-muted-foreground" />
                 <span className="text-xs font-bold">Meeting_Notes_Architecture_Review.md</span>
               </div>
               <div className="bg-accent/10 border border-accent/20 p-4">
                 <div className="text-[10px] font-mono uppercase font-bold text-accent mb-2">{t('actionItemsExtracted')}</div>
                 <ul className="text-xs space-y-2 list-disc list-inside">
                   <li>Draft API specification for User Profile service</li>
                   <li>{t('evaluateCostImpactOfSwitchingToDocumentdb')}</li>
                   <li>{t('scheduleFollowUpWithSecurityOnEncryptionAt')}</li>
                 </ul>
                  <Button 
                    onClick={handleConvertToTasks}
                    disabled={convertState !== 'idle'}
                    className="w-full mt-4 h-8 rounded bg-surface border border-border rounded text-xs font-mono uppercase tracking-widest hover:bg-surface-hover text-foreground"
                  >
                    {convertState === 'idle' ? t('convertToTasks') : convertState === 'converting' ? <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> {t('converting')}</span> : <span className="flex items-center gap-2 text-accent"><CheckCircle2 className="w-3 h-3"/> 3 Tasks Created</span>}
                  </Button>
               </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <Database className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('askQuestionsAcrossTheKnowledgeYourTeamAlread')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('summarizeDocuments')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('extractActionItems')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('convertMeetingNotesIntoTasks')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('generatePrdsDesignDrafts')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('generateApiDocumentationDrafts')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('findOutdatedDocuments')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('generateOnboardingGuides')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 - AI for leadership */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('getClearAnswersWithoutChasingStatusUpdates')}</h2>
              </div>
              <div className="space-y-4 font-mono text-sm uppercase tracking-widest mb-8">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('projectRiskSummaries')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('deliveryForecasts')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('sprintSummaries')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('executiveReports')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('teamCapacityAnalysis')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('bottleneckDetection')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('clientStatusReports')}</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-accent" /> {t('incidentSummaries')}</div>
              </div>
            </div>
            
            <div className="border border-border rounded bg-surface p-6 shadow-xl">
               <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2 flex justify-between">
                 <span>{t('executiveSummaryReport')}</span>
                 <AiLogo className="w-3 h-3 text-accent" />
               </div>
               <div className="bg-background border border-border rounded p-4 text-sm leading-relaxed border-l-2 border-emerald-500">
                 <p className="mb-2 font-bold text-emerald-500">{t('forecastOnTrack')}</p>
                 <p className="mb-4">The Core Platform Migration is 85% complete and is projected to ship by Friday. Velocity increased by 12% this sprint following the resolution of the legacy API blockers.</p>
                 <p className="text-xs text-muted-foreground">{t('generatedFrom45Tasks12PullRequestsAnd')}</p>
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 - AI control model */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{t('aiWithEnterpriseGuardrails')}</h2>
            <p className="text-muted-foreground text-lg">
              {t('coopsetuAiRespectsTheSamePermissionsAccessCo')}
            </p>
          </div>

          <div className="bg-surface border border-border rounded p-8 mb-16 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {[
                { name: t('userRequest'), icon: Search },
                { name: t('permissionCheck'), icon: Lock },
                { name: t('dataClassificationCheck'), icon: Shield },
                { name: t('approvedSources'), icon: Database },
                { name: t('aiResponse'), icon: AiLogo },
                { name: t('sourceCitations'), icon: FileText },
                { name: t('auditLog'), icon: Eye },
              ].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center flex-1">
                    <div className="w-10 h-10 bg-background border border-border rounded flex items-center justify-center mb-3 text-foreground">
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-center">{step.name}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden md:block flex-shrink-0 text-muted-foreground">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                  {i < arr.length - 1 && (
                    <div className="md:hidden flex-shrink-0 text-muted-foreground my-2">
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              {t('aiOnlyAccessesContentTheUserCanAlready')}
            </div>
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              {t('restrictedDataIsProtected')}
            </div>
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              {t('aiOutputsIncludeSourceReferences')}
            </div>
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <Eye className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              {t('aiUseIsLogged')}
            </div>
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <X className="w-4 h-4 text-orange-500 flex-shrink-0" />
              {t('aiCannotAutoDeployProductionCode')}
            </div>
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <X className="w-4 h-4 text-orange-500 flex-shrink-0" />
              {t('aiCannotAutoApproveSecurityOrReleaseGates')}
            </div>
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <X className="w-4 h-4 text-orange-500 flex-shrink-0" />
              {t('aiGeneratedAssignmentsNeedHumanApproval')}
            </div>
            <div className="bg-background border border-border rounded p-4 flex gap-3">
              <X className="w-4 h-4 text-orange-500 flex-shrink-0" />
              {t('aiCannotMakeHiringFiringPromotionOrSalary')}
            </div>
          </div>
        </section>

        {/* SECTION 7 - Suggested prompts */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32 border-t border-border pt-32">
           <h2 className="text-2xl font-bold tracking-tight mb-12 text-center">{t('whatWillYouAsk')}</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {[
               "Which programmes are at risk this week?",
               "Summarize Batch 24 progress.",
               "Show blocked work in the Dairy Co-op programme.",
               "Draft the assessment plan for module 3.",
               "Why did last week's attendance drop?",
               "Generate a weekly institute update.",
               "Find course material related to credit appraisal.",
               "Which trainers are above planned capacity?"
             ].map((prompt, i) => (
               <div key={i} className="border border-border rounded bg-surface hover:bg-surface-hover transition-colors p-6 flex flex-col justify-between min-h-[140px] cursor-pointer group">
                 <MessageSquare className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors mb-4" />
                 <p className="text-sm font-mono leading-relaxed">&quot;{prompt}&quot;</p>
               </div>
             ))}
           </div>
        </section>

        {/* SECTION 8 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16 border-t border-border">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            {t('moveFasterWithAiKeepControlWithYour')}
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/dashboard', 'demo')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('requestDemo')}
            </Button>
            <Button 
              variant="outline"
              className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              {t('talkToAnAiSpecialist')}
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
