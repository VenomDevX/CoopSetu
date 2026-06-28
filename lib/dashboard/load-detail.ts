import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getCurrentMembership, type Membership } from '@/lib/auth/get-current-membership';
import { hasPermission } from '@/lib/auth/require-organization';

/**
 * Result of resolving a single record for a detail page. The three failure
 * states map to the UI states the page renders (403 / 404). `forbidden` is
 * returned *before* any record is read, so an unauthorized caller never receives
 * record metadata.
 */
export type DetailResult<T> =
  | { state: 'forbidden' }
  | { state: 'notfound' }
  | { state: 'ok'; data: T; membership: Membership; supabase: SupabaseClient };

/**
 * Load one record for a detail surface with layered access control:
 *  1. Membership — the caller must be an active member of an organization.
 *  2. Role permission — when `permission` is given, the caller must hold it
 *     (admins implicitly). Checked before the fetch so 403 leaks no metadata.
 *  3. Record-level org access — the query is filtered by the record id *and*
 *     `organization_id = <caller's active org>`. Combined with table RLS this
 *     guarantees another organization can never read a record by guessing its
 *     id: a foreign id resolves to null → 404, never to data.
 *
 * A malformed (non-uuid) id makes the query error → treated as not found (404).
 */
export async function loadDetail<T>(opts: {
  table: string;
  id: string;
  select: string;
  permission?: string;
}): Promise<DetailResult<T>> {
  const supabase = await createClient();
  const membership = await getCurrentMembership();
  if (!membership) return { state: 'forbidden' };
  if (opts.permission && !hasPermission(membership, opts.permission)) {
    return { state: 'forbidden' };
  }

  const { data, error } = await supabase
    .from(opts.table)
    .select(opts.select)
    .eq('id', opts.id)
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  if (error || !data) return { state: 'notfound' };
  return { state: 'ok', data: data as T, membership, supabase };
}

/**
 * Resolve `organization_member_id` → display name for the given ids, RLS-scoped
 * to what the caller may read. Ids that cannot be resolved are simply omitted
 * (the caller falls back to a neutral label) — never fabricated.
 */
export async function resolveMemberNames(
  supabase: SupabaseClient,
  ids: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (uniq.length === 0) return {};
  const { data } = await supabase
    .from('organization_members')
    .select('id, profile:profiles!org_members_profile_fk(full_name, email)')
    .in('id', uniq);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; profile: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null }[]) {
    const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const name = p?.full_name ?? p?.email;
    if (name) map[row.id] = name;
  }
  return map;
}

export interface LinkedRef { label: string; href: string }

/** Resolve a linked project → clickable field, RLS-scoped (null if inaccessible). */
export async function linkProject(supabase: SupabaseClient, id?: string | null): Promise<LinkedRef | null> {
  if (!id) return null;
  const { data } = await supabase.from('projects').select('name, code').eq('id', id).maybeSingle();
  if (!data) return null;
  return { label: data.code ? `${data.code} — ${data.name}` : data.name, href: `/dashboard/projects/${id}` };
}

/** Resolve a linked release → clickable field, RLS-scoped (null if inaccessible). */
export async function linkRelease(supabase: SupabaseClient, id?: string | null): Promise<LinkedRef | null> {
  if (!id) return null;
  const { data } = await supabase.from('releases').select('name, version').eq('id', id).maybeSingle();
  if (!data) return null;
  return { label: data.version ? `${data.name} ${data.version}` : data.name, href: `/dashboard/releases/${id}` };
}

/** Resolve a linked task → clickable field, RLS-scoped (null if inaccessible). */
export async function linkTask(supabase: SupabaseClient, id?: string | null): Promise<LinkedRef | null> {
  if (!id) return null;
  const { data } = await supabase.from('tasks').select('task_key, title').eq('id', id).maybeSingle();
  if (!data) return null;
  return { label: `${data.task_key}: ${data.title}`, href: `/dashboard/tasks/${id}` };
}
