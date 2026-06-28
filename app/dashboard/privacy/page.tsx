export default function PrivacyPage() {
  const sections = [
    {
      title: '1. Information We Collect',
      body: `We collect information you provide directly — such as your name, email address, and organization details when you register. We also collect information generated through your use of the platform, including task data, project metadata, and activity logs. We do not collect sensitive personal information beyond what is necessary to operate the service.`,
    },
    {
      title: '2. How We Use Your Information',
      body: `We use collected information to operate, maintain, and improve Handoff; to authenticate users and enforce role-based permissions; to send transactional communications (e.g., notifications, invitations); and to generate aggregate, anonymized analytics about platform usage. We do not sell your personal data to third parties.`,
    },
    {
      title: '3. Data Storage & Security',
      body: `All data is stored on infrastructure hosted within the European Union and the United States. We employ industry-standard security measures including encryption at rest (AES-256) and in transit (TLS 1.3), row-level security at the database layer, and regular third-party security audits. Access to production data is strictly limited to authorized personnel.`,
    },
    {
      title: '4. Data Sharing',
      body: `We may share your information with trusted sub-processors (e.g., Supabase for database hosting, Vercel for application hosting) solely as required to deliver the service. Any sub-processor is contractually bound to the same data protection standards. We will disclose data when required by law or to protect the safety of users and the platform.`,
    },
    {
      title: '5. Cookies & Tracking',
      body: `Handoff uses session cookies strictly necessary for authentication. We do not use third-party advertising cookies or behavioral tracking. You may disable cookies in your browser settings, but doing so will prevent you from accessing authenticated features.`,
    },
    {
      title: '6. Your Rights',
      body: `Depending on your jurisdiction you may have rights to access, correct, delete, or export your personal data. To exercise these rights, contact privacy@handoff.dev. We will respond to verified requests within 30 days.`,
    },
    {
      title: '7. Data Retention',
      body: `We retain your data for as long as your account is active or as needed to provide services. Organization owners may request full data deletion upon account closure. Backups are purged within 90 days of account termination.`,
    },
    {
      title: '8. Changes to This Policy',
      body: `We may update this Privacy Policy from time to time. We will notify you of material changes via email or an in-app notice at least 14 days before they take effect. Continued use of the platform after changes take effect constitutes acceptance of the revised policy.`,
    },
    {
      title: '9. Contact',
      body: `Questions about this policy? Email us at privacy@handoff.dev or write to: Handoff Inc., Privacy Team, 1 Enterprise Way, San Francisco, CA 94105.`,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-widest mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground font-mono">Last updated: 2026-06-28</p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        This Privacy Policy describes how Handoff ("we", "us", or "our") collects, uses, and protects information about you when you use the Handoff enterprise platform.
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
