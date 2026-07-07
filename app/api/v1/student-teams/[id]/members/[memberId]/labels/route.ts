import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';
import { updateMemberLabelsSchema } from '@/lib/validation/student-team';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { notifyStudentTeamEvent } from '@/services/student-workspace.service';

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** PUT (replace-set) a student team member's functional contribution labels.
 * Assignable only by the Team Lead or a Co-Lead with student_team:manage_labels
 * — labels are collaboration metadata only and never grant permissions. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const { id, memberId } = await params;
    const { supabase } = await requireUser();
    const membership = await requireOrganization(id);
    requirePermission(membership, 'student_team:manage_labels');

    const { labels } = updateMemberLabelsSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: target } = await admin
      .from('organization_members')
      .select('id')
      .eq('id', memberId)
      .eq('organization_id', id)
      .maybeSingle();
    if (!target) throw Errors.notFound('Member not found in this team.');

    // De-dupe by normalized form while preserving the first display casing seen.
    const seen = new Map<string, string>();
    for (const raw of labels) {
      const normalized = normalizeLabel(raw);
      if (normalized && !seen.has(normalized)) seen.set(normalized, raw.trim());
    }

    await admin.from('student_team_member_labels').delete().eq('organization_member_id', memberId);

    if (seen.size > 0) {
      const rows = Array.from(seen.entries()).map(([label_normalized, label]) => ({
        organization_member_id: memberId,
        label,
        label_normalized,
        assigned_by: membership.memberId,
      }));
      const { error } = await admin.from('student_team_member_labels').insert(rows);
      if (error) throw Errors.internal('Failed to save labels.');
    }

    await createAuditLog(supabase, {
      organizationId: id,
      action: 'student_team.member_labels_updated',
      entityType: 'organization_member',
      entityId: memberId,
      afterState: { labels: Array.from(seen.values()) },
    });

    await notifyStudentTeamEvent(
      supabase, id, [memberId], 'STUDENT_TEAM_LABELS_CHANGED',
      'Your team labels have changed', 'Your functional labels were updated by your team lead.',
    ).catch(() => {});

    return ok({ memberId, labels: Array.from(seen.values()) });
  });
}
