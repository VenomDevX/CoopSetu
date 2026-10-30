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

  /**
   * Public certificate verification.
   *
   * Goes through the `verify_certificate` SECURITY DEFINER function rather than
   * selecting from `certificates` directly: this endpoint is reachable
   * unauthenticated, and `anon` holds no SELECT grant on the table (the only
   * policy is org-scoped). Querying the table as anon silently returned no row,
   * so valid certificates were reported as "not found". See migration 0077.
   *
   * The function returns a curated column list and never exposes the holder's
   * email, which the previous `trainees(profiles:user_id(...))` join selected
   * and no caller ever used.
   */
  async verify(certNumber: string) {
    const { data, error } = await this.supabase
      .rpc('verify_certificate', { p_certificate_number: certNumber });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { valid: false, message: 'Certificate not found' };

    // Reshape to the response contract callers already depend on
    // (`certificate.programmes.title` is rendered by the certificates page).
    const certificate = {
      certificate_number: row.certificate_number,
      title: row.title,
      issued_at: row.issued_at,
      valid_until: row.valid_until,
      status: row.status,
      issuer_name: row.issuer_name,
      holder_name: row.holder_name,
      programmes: row.programme_title ? { title: row.programme_title } : null,
    };

    if (row.status === 'REVOKED') return { valid: false, message: 'Certificate has been revoked', certificate };
    if (row.status === 'EXPIRED') return { valid: false, message: 'Certificate has expired', certificate };
    if (row.valid_until && new Date(row.valid_until) < new Date()) {
      return { valid: false, message: 'Certificate has expired', certificate };
    }

    return { valid: true, message: 'Certificate is valid', certificate };
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
