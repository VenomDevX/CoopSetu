import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { Errors } from '@/lib/api/errors';
import { encrypt } from '@/lib/security/encryption';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { GITHUB_OAUTH_STATE_COOKIE } from '@/lib/integrations/github-oauth';

function clearOauthStateCookie(res: NextResponse) {
  res.cookies.set(GITHUB_OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    requirePermission(m, 'integration:manage');

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const cookieState = req.cookies.get(GITHUB_OAUTH_STATE_COOKIE)?.value;

    if (!state || !cookieState || state !== cookieState) {
      const res = NextResponse.redirect(
        new URL('/dashboard/settings?integration_error=' + encodeURIComponent('Connection request could not be verified (possible CSRF). Please try connecting GitHub again.'), req.url),
      );
      return clearOauthStateCookie(res);
    }

    if (!code) {
      throw Errors.validation('Missing authorization code');
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw Errors.internal('Missing GitHub Client ID or Secret');
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw Errors.internal(`GitHub OAuth Error: ${tokenData.error_description}`);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw Errors.internal('Failed to retrieve access token from GitHub');
    }

    // Encrypt the token securely
    const secretsJson = JSON.stringify({ access_token: accessToken });
    const encryptedPayload = encrypt(secretsJson);

    // Upsert the integration record
    // We check if a github integration already exists for this org
    const { data: existing } = await supabase.from('integrations')
      .select('id')
      .eq('organization_id', m.organizationId)
      .eq('provider', 'github')
      .single();

    let integrationId = existing?.id;

    if (existing) {
      const { error: updateError } = await supabase.from('integrations')
        .update({ encrypted_secrets: encryptedPayload, status: 'ACTIVE' })
        .eq('id', existing.id);
        
      if (updateError) throw Errors.internal(updateError.message);
    } else {
      const { data: inserted, error: insertError } = await supabase.from('integrations')
        .insert({
          organization_id: m.organizationId,
          provider: 'github',
          display_name: 'GitHub',
          status: 'ACTIVE',
          encrypted_secrets: encryptedPayload,
          config: {}
        })
        .select('id')
        .single();
        
      if (insertError) throw Errors.internal(insertError.message);
      integrationId = inserted.id;
    }

    await createAuditLog(supabase, {
      organizationId: m.organizationId,
      action: 'integration.github_connected',
      entityType: 'integration',
      entityId: integrationId,
    });

    // We can use a cookie to signal the frontend to update its mock state
    const res = NextResponse.redirect(new URL('/dashboard/settings?integration=success', req.url));
    res.cookies.set('github_connected', 'true', { path: '/' });
    return clearOauthStateCookie(res);

  } catch (error: any) {
    console.error('GitHub Callback Error:', error);
    // Redirect back to settings with an error parameter
    const res = NextResponse.redirect(new URL(`/dashboard/settings?integration_error=${encodeURIComponent(error.message || 'Unknown error')}`, req.url));
    return clearOauthStateCookie(res);
  }
}
