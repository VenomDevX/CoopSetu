import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateIntegrationSecrets } from '@/services/integration.service';
import { z } from 'zod';
import { Errors } from '@/lib/api/errors';

// Strictly validate that secrets payload is a flat key-value object of strings
const secretsSchema = z.record(z.string(), z.string());

export async function PATCH(req: Request, { params }: { params: Promise<{ integrationId: string }> }) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    
    // Only administrators should be able to update integration secrets
    requirePermission(m, 'integration:manage');
    
    const { integrationId } = await params;
    if (!integrationId) {
      throw Errors.validation('Integration ID is required');
    }
    const body = await req.json();
    const secrets = secretsSchema.parse(body);

    const updated = await updateIntegrationSecrets(supabase, m.organizationId, integrationId, secrets);
    return ok(updated);
  });
}
