export default function TermsPage() {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      body: `By accessing or using the Handoff platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.`,
    },
    {
      title: '2. Description of Service',
      body: `Handoff provides a software-as-a-service platform for project management, sprint planning, incident tracking, and AI-assisted workflows. The Service is provided on a subscription basis, and features may vary by plan tier.`,
    },
    {
      title: '3. Account Registration',
      body: `You must create an account to use the Service. You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. You must promptly notify us of any unauthorized use at security@handoff.dev.`,
    },
    {
      title: '4. Acceptable Use',
      body: `You agree not to: (a) use the Service to transmit harmful, illegal, or infringing content; (b) attempt to gain unauthorized access to any part of the Service or its infrastructure; (c) reverse-engineer or resell the Service without express written consent; (d) use automated means to scrape or extract data beyond standard API usage.`,
    },
    {
      title: '5. Intellectual Property',
      body: `Handoff and its licensors own all rights, title, and interest in the Service, including all software, designs, trademarks, and documentation. Your data remains your property. You grant Handoff a limited license to host, store, and process your data solely to deliver the Service.`,
    },
    {
      title: '6. Subscription & Payment',
      body: `Fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law or as described in our Refund Policy. Handoff reserves the right to modify pricing with 30 days' notice. Failure to pay may result in suspension or termination of your account.`,
    },
    {
      title: '7. Confidentiality',
      body: `Each party agrees to protect the other's confidential information using the same degree of care it uses for its own confidential information (but not less than reasonable care). This obligation does not apply to information that is publicly available, independently developed, or lawfully obtained from a third party.`,
    },
    {
      title: '8. Disclaimers',
      body: `THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.`,
    },
    {
      title: '9. Limitation of Liability',
      body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, HANDOFF WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM.`,
    },
    {
      title: '10. Termination',
      body: `Either party may terminate this agreement with 30 days' written notice. We may suspend or terminate your account immediately for material breach of these Terms. Upon termination you may export your data within 14 days; after that period we may delete it in accordance with our retention policy.`,
    },
    {
      title: '11. Governing Law',
      body: `These Terms are governed by the laws of the State of California, USA, without regard to conflict-of-law provisions. Disputes shall be resolved exclusively in the state or federal courts located in San Francisco County, California.`,
    },
    {
      title: '12. Changes to Terms',
      body: `We may revise these Terms at any time. We will provide at least 14 days' notice of material changes via email or in-app notification. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms.`,
    },
    {
      title: '13. Contact',
      body: `Questions about these Terms? Contact legal@handoff.dev or write to: Handoff Inc., Legal Department, 1 Enterprise Way, San Francisco, CA 94105.`,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-widest mb-2">Terms of Service</h1>
        <p className="text-xs text-muted-foreground font-mono">Last updated: 2026-06-28 · Effective: 2026-07-01</p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Please read these Terms of Service carefully before using Handoff. They govern your access to and use of our enterprise platform.
      </p>

      <div className="space-y-6">
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest border-b border-border pb-2">{s.title}</h2>
            <p className="text-sm leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
