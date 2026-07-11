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

const FAQS = [
  {
    question: "Can we start with a small team?",
    answer: "Yes, our Team plan is designed for growing product and engineering teams. You can start small and upgrade as your organization scales and requires more advanced portfolio management or enterprise governance."
  },
  {
    question: "Is Handoff available for large organizations?",
    answer: "Absolutely. Handoff is built specifically to coordinate complex delivery across hundreds of teams, offering advanced governance, security controls, and cross-team visibility."
  },
  {
    question: "Can we use SSO?",
    answer: "Yes, Single Sign-On (SSO), SAML, and OpenID Connect, along with SCIM provisioning, are fully supported on the Enterprise plan to integrate seamlessly with your existing identity providers."
  },
  {
    question: "Can we import from Jira?",
    answer: "Yes, we offer dedicated import tools and scripts to migrate your projects, issues, and histories directly from Jira, Trello, and Asana into Handoff."
  },
  {
    question: "Does Handoff integrate with GitHub?",
    answer: "Yes, Handoff features deep integrations with GitHub, GitLab, and Bitbucket. You can link branches, view pull requests, track CI/CD statuses, and block merges based on task approvals directly from your workspace."
  },
  {
    question: "Can we control AI access?",
    answer: "Yes, on the Enterprise plan, Handoff AI operates under strict enterprise guardrails. It respects existing user permissions, logs prompts for auditing, and includes configurable access controls to protect restricted data."
  },
  {
    question: "Is enterprise onboarding available?",
    answer: "Yes, Enterprise customers receive dedicated onboarding support, custom training sessions, and an assigned account manager to ensure a smooth transition and tailored setup for your workflows."
  },
  {
    question: "Can pricing be customized?",
    answer: "Our Enterprise plan offers custom pricing based on your specific organizational size, required features, and deployment needs. Contact our sales team to build a package that works for you."
  }
];

export default function PricingPage() {
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
              Pricing that scales with how your teams deliver.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              Start with core work management. Add enterprise governance, AI controls, and organization-wide reporting as your needs grow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => handleNavigate('/contact', 'sales')}
                className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Start a Conversation
              </Button>
              <Button 
                onClick={() => handleNavigate('/contact', 'demo')}
                variant="outline"
                className="border-border text-foreground hover:bg-surface-hover rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
              >
                Request Demo
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
                Monthly
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${isAnnual ? 'bg-background border border-border rounded text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Annually
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
                <h3 className="text-2xl font-bold tracking-tight mb-2">Team</h3>
                <p className="text-sm text-muted-foreground">Growing product and engineering teams.</p>
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
                Start with Team
              </Button>
              <div className="space-y-4 text-sm mt-auto">
                <div className="font-bold text-xs uppercase tracking-widest mb-4 font-mono">Features</div>
                {[
                  'Projects and tasks',
                  'Kanban boards',
                  'Basic sprint planning',
                  'Team workload view',
                  'Basic dashboards',
                  'Comments and attachments',
                  'Documents',
                  'Standard integrations',
                  'Basic Handoff AI summaries',
                  'Email support'
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
                Most Popular
              </div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold tracking-tight mb-2">Business</h3>
                <p className="text-sm text-muted-foreground">Multi-team engineering organizations.</p>
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
                Choose Business
              </Button>
              <div className="space-y-4 text-sm mt-auto">
                <div className="font-bold text-xs uppercase tracking-widest mb-4 font-mono">Everything in Team, plus:</div>
                {[
                  'Programs and portfolios',
                  'Advanced sprint planning',
                  'Capacity planning',
                  'Roadmaps and dependencies',
                  'Advanced reporting',
                  'QA and bug tracking',
                  'Release management',
                  'GitHub and CI/CD integrations',
                  'Handoff AI planning and analytics',
                  'Scheduled reports',
                  'Priority support'
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
                <h3 className="text-2xl font-bold tracking-tight mb-2">Enterprise</h3>
                <p className="text-sm text-muted-foreground">Large technology, fintech, and regulated organizations.</p>
              </div>
              <div className="mb-8">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-bold tracking-tight">Custom</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Contact us for a quote
                </div>
              </div>
              <Button 
                onClick={() => handleNavigate('/contact', 'sales')}
                variant="outline" 
                className="w-full rounded border-border h-10 font-mono text-xs uppercase tracking-widest mb-8 hover:bg-surface-hover"
              >
                Contact Sales
              </Button>
              <div className="space-y-4 text-sm mt-auto">
                <div className="font-bold text-xs uppercase tracking-widest mb-4 font-mono">Everything in Business, plus:</div>
                {[
                  'SSO / SAML & SCIM provisioning',
                  'Advanced role-based access control',
                  'Project-level restrictions',
                  'Approval workflows & gates',
                  'Security review workflows',
                  'Compliance evidence management',
                  'Enterprise AI controls',
                  'AI prompt logging',
                  'Data classification',
                  'Dedicated onboarding',
                  'Enterprise support & Account management'
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
                  Handoff Add-On
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">AI with controls built for enterprise work.</h2>
                <p className="text-muted-foreground mb-8 text-lg">
                  Empower your teams with generative AI that respects your existing access controls, data boundaries, and compliance requirements.
                </p>
                <Button 
                  onClick={() => handleNavigate('/contact', 'ai')}
                  className="rounded bg-foreground text-background h-10 px-6 font-mono text-xs uppercase tracking-widest"
                >
                  Learn About Enterprise AI
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">Permission-aware AI</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">Source citations</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <Eye className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">Prompt logging</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">Restricted data controls</div>
                </div>
                <div className="bg-background border border-border rounded p-4 flex gap-3">
                  <UserCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm font-bold">Human approval workflows</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARE PLANS */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Compare plans</h2>
            <p className="text-muted-foreground">Find the right level of control and visibility for your organization.</p>
          </div>
          
          <div className="overflow-x-auto border border-border rounded bg-background shadow-xl">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="p-4 w-1/3 font-bold">Features</th>
                  <th className="p-4 w-[22%] font-bold text-center">Team</th>
                  <th className="p-4 w-[22%] font-bold text-center">Business</th>
                  <th className="p-4 w-[22%] font-bold text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Work Management */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">Work Management</td></tr>
                <tr>
                  <td className="p-4">Projects and tasks</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">Kanban & List views</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">Custom fields & statuses</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Agile Delivery */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">Agile Delivery</td></tr>
                <tr>
                  <td className="p-4">Sprint planning</td>
                  <td className="p-4 text-center">Basic</td>
                  <td className="p-4 text-center">Advanced</td>
                  <td className="p-4 text-center">Advanced</td>
                </tr>
                <tr>
                  <td className="p-4">Capacity planning</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Portfolio Management */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">Portfolio Management</td></tr>
                <tr>
                  <td className="p-4">Programs and portfolios</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">Roadmaps & dependencies</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Engineering Integration */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">Engineering Integration</td></tr>
                <tr>
                  <td className="p-4">GitHub / GitLab / Bitbucket</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">CI/CD tracking</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Security and Compliance */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">Security and Compliance</td></tr>
                <tr>
                  <td className="p-4">Role-based access</td>
                  <td className="p-4 text-center">Basic</td>
                  <td className="p-4 text-center">Advanced</td>
                  <td className="p-4 text-center">Custom</td>
                </tr>
                <tr>
                  <td className="p-4">Approval workflows & gates</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">Audit logs</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">Compliance evidence</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>

                {/* AI Features */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">AI Features</td></tr>
                <tr>
                  <td className="p-4">Basic summaries</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">Planning & Analytics AI</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">Enterprise AI Controls</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center">Add-on</td>
                </tr>

                {/* Administration */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">Administration</td></tr>
                <tr>
                  <td className="p-4">SSO / SAML</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                <tr>
                  <td className="p-4">SCIM provisioning</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><CheckCircle2 className="w-4 h-4 mx-auto text-foreground" /></td>
                </tr>
                
                {/* Support */}
                <tr className="bg-surface-hover/50"><td colSpan={4} className="p-4 font-mono text-[10px] uppercase tracking-widest font-bold">Support</td></tr>
                <tr>
                  <td className="p-4">Support level</td>
                  <td className="p-4 text-center">Email</td>
                  <td className="p-4 text-center">Priority</td>
                  <td className="p-4 text-center">Enterprise</td>
                </tr>
                <tr>
                  <td className="p-4">Dedicated onboarding</td>
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
            <h2 className="text-3xl font-bold tracking-tight mb-4">Frequently asked questions</h2>
          </div>
          
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-border rounded bg-background">
                <button 
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-bold">{faq.question}</span>
                  {openFaq === i ? (
                    <Minus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-muted-foreground text-sm leading-relaxed border-t border-border pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 8 - Final CTA */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto text-center py-16 border-t border-border">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 max-w-3xl mx-auto">
            Build your delivery operating system.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => handleNavigate('/contact', 'sales')}
              className="bg-foreground text-background hover:bg-foreground/90 rounded h-12 px-8 font-mono uppercase tracking-widest text-xs"
            >
              Contact Sales
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
