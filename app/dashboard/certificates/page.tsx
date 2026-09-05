'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Search, QrCode, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useTranslations } from 'next-intl';

interface Certificate {
  id: string;
  certificate_number: string;
  title: string;
  issued_at: string;
  status: string;
  trainee_id: string;
  programmes?: { title: string };
  trainees?: { profiles: { full_name: string; email: string } };
}

interface VerifyResult { valid: boolean; message: string; certificate?: Certificate; }

export default function CertificatesPage() {
  const t = useTranslations('Certificates');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, revoked: 0 });
  const [search, setSearch] = useState('');
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const load = useCallback(() => {
    fetch('/api/v1/certificates').then(r => r.json()).then(j => {
      if (j?.data) { setCertificates(j.data.certificates || []); setStats(s => j.data.stats || s); }
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    if (!verifyInput) return;
    const res = await fetch(`/api/v1/certificates/verify?cert_number=${encodeURIComponent(verifyInput)}`);
    const j = await res.json();
    setVerifyResult(j?.data || null);
  };

  const filtered = certificates.filter(c => !search || c.certificate_number.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase()));

  const statusColor = (s: string) => {
    switch (s) { case 'ACTIVE': return 'border-green-500/40 text-green-500 bg-green-500/10'; case 'REVOKED': return 'border-red-500/40 text-red-500 bg-red-500/10'; case 'EXPIRED': return 'border-orange-500/40 text-orange-500 bg-orange-500/10'; default: return 'border-border text-muted-foreground'; }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border-b border-border pb-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
          Learning_LMS // Certificates
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">{t('heading')}</h1>
      </motion.div>

      {/* Verify Section */}
      <Card className="shadow-none border-2 border-accent/20 rounded bg-background">
        <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest flex items-center gap-2"><QrCode className="w-4 h-4" /> {t('verifyCertificate')}</CardTitle></CardHeader>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <input className="flex-1 px-3 py-2 border border-border rounded bg-background text-sm font-mono uppercase" placeholder="Enter certificate number (e.g. CERT-NCCT-2026-123456)" value={verifyInput} onChange={e => setVerifyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerify()} />
            <Button onClick={handleVerify} className="rounded font-mono text-xs uppercase">{t('verify')}</Button>
          </div>
          {verifyResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-4 p-4 border rounded flex items-start gap-3 ${verifyResult.valid ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
              {verifyResult.valid ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
              <div>
                <div className={`font-bold text-sm ${verifyResult.valid ? 'text-green-500' : 'text-red-500'}`}>{verifyResult.message}</div>
                {verifyResult.certificate && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono space-y-1">
                    <div>Certificate: {verifyResult.certificate.certificate_number}</div>
                    <div>Title: {verifyResult.certificate.title}</div>
                    <div>Issued: {new Date(verifyResult.certificate.issued_at).toLocaleDateString()}</div>
                    {verifyResult.certificate.programmes && <div>Programme: {(verifyResult.certificate.programmes as any).title}</div>}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: t('totalCertificates'), value: stats.total, icon: <Award className="w-5 h-5" /> },
          { label: t('active'), value: stats.active, icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: t('revoked'), value: stats.revoked, icon: <XCircle className="w-5 h-5" /> },
        ].map((s, i) => (
          <Card key={i} className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="font-mono text-[10px] uppercase tracking-widest">{s.label}</span>
                <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors">{s.icon}</div>
              </div>
              <div className="text-3xl font-bold text-foreground tracking-tighter">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Certificate List */}
      <div className="border border-border rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_150px_120px_80px] gap-4 px-4 py-3 bg-surface-hover font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border hidden md:grid">
          <span>{t('colCertificateNumber')}</span><span>{t('colTitle')}</span><span>{t('colProgramme')}</span><span>{t('colIssued')}</span><span>{t('colStatus')}</span>
        </div>
        {filtered.map(cert => (
          <div key={cert.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_150px_120px_80px] gap-2 md:gap-4 px-4 py-3 border-b border-border hover:bg-surface-hover transition-colors items-center">
            <code className="text-xs font-mono text-foreground">{cert.certificate_number}</code>
            <span className="text-sm text-foreground">{cert.title}</span>
            <span className="text-xs text-muted-foreground">{(cert.programmes as any)?.title || '—'}</span>
            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(cert.issued_at).toLocaleDateString()}</span>
            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded w-fit ${statusColor(cert.status)}`}>{cert.status}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {t('noCertificates')}
          </div>
        )}
      </div>
    </div>
  );
}
