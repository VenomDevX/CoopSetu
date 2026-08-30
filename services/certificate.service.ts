import { SupabaseClient } from '@supabase/supabase-js';

export interface Certificate {
  id: string;
  trainee_id: string;
  programme_id: string;
  certificate_number: string;
  title: string;
  issued_at: string;
  valid_until?: string;
  issuer_name: string;
  qr_code?: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  programmes?: { title: string };
  trainees?: { profiles: { full_name: string; email: string } };
}

export class CertificateService {
  constructor(private supabase: SupabaseClient) {}

  private generateCertNumber(): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(100000 + Math.random() * 900000);
    return `CERT-NCCT-${year}-${seq}`;
  }

  async issue(input: { trainee_id: string; programme_id: string; title: string; issuer_name?: string; valid_until?: string; metadata?: Record<string, unknown> }) {
    const certNumber = this.generateCertNumber();
    
    const { data, error } = await this.supabase
      .from('certificates')
      .insert({
        ...input,
        certificate_number: certNumber,
        issuer_name: input.issuer_name || 'NCCT',
        qr_code: certNumber, // QR encodes the certificate number for verification
        status: 'ACTIVE',
      })
      .select()
      .single();
    if (error) throw error;
    return data as Certificate;
  }

  async verify(certNumber: string) {
    const { data, error } = await this.supabase
      .from('certificates')
      .select('*, programmes(title), trainees(id, profiles:user_id(full_name, email))')
      .eq('certificate_number', certNumber)
      .single();
    
    if (error || !data) return { valid: false, message: 'Certificate not found' };
    
    if (data.status === 'REVOKED') return { valid: false, message: 'Certificate has been revoked', certificate: data };
    if (data.status === 'EXPIRED') return { valid: false, message: 'Certificate has expired', certificate: data };
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      return { valid: false, message: 'Certificate has expired', certificate: data };
    }

    return { valid: true, message: 'Certificate is valid', certificate: data };
  }

  async listByTrainee(traineeId: string) {
    const { data, error } = await this.supabase
      .from('certificates')
      .select('*, programmes(title)')
      .eq('trainee_id', traineeId)
      .order('issued_at', { ascending: false });
    if (error) throw error;
    return data as Certificate[];
  }

  async listAll(orgId: string) {
    const { data, error } = await this.supabase
      .from('certificates')
      .select('*, programmes(title), trainees(id, profiles:user_id(full_name, email))')
      .eq('programmes.organization_id', orgId)
      .order('issued_at', { ascending: false });
    if (error) throw error;
    return data as Certificate[];
  }

  async revoke(id: string) {
    const { data, error } = await this.supabase
      .from('certificates')
      .update({ status: 'REVOKED' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Certificate;
  }

  async getStats(orgId: string) {
    const { data, error } = await this.supabase
      .from('certificates')
      .select('id, status, programmes!inner(organization_id)')
      .eq('programmes.organization_id', orgId);
    if (error) throw error;
    const certs = data || [];
    return {
      total: certs.length,
      active: certs.filter(c => c.status === 'ACTIVE').length,
      revoked: certs.filter(c => c.status === 'REVOKED').length,
    };
  }
}
