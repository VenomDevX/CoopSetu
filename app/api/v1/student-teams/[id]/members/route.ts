import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization } from '@/lib/auth/require-organization';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    await requireUser();
    await requireOrganization(id); // throws 403 if caller isn't a member of this team

    const admin = createAdminClient();
    const { data: members, error } = await admin
      .from('organization_members')
      .select(`
        id, user_id, is_active,
        profiles:org_members_profile_fk ( full_name, email ),
        member_roles!member_roles_organization_member_id_fkey ( roles ( code ) ),
        student_team_member_labels!student_team_member_labels_organization_member_id_fkey ( label )
      `)
      .eq('organization_id', id)
      .eq('is_active', true);

    if (error) throw Errors.internal(error.message);

    const result = (members ?? []).map((m: any) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const roleCodes: string[] = (m.member_roles || []).map((mr: any) => mr.roles?.code).filter(Boolean);
      const roleCode = roleCodes.includes('STUDENT_TEAM_LEAD')
        ? 'STUDENT_TEAM_LEAD'
        : roleCodes.includes('STUDENT_CO_LEAD')
          ? 'STUDENT_CO_LEAD'
          : 'STUDENT_MEMBER';
      return {
        id: m.id,
        user_id: m.user_id,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        roleCode,
        labels: (m.student_team_member_labels || []).map((l: any) => l.label),
        is_active: m.is_active,
      };
    });

    return ok(result);
  });
}
