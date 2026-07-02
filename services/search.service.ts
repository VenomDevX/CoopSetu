import type { SupabaseClient } from '@supabase/supabase-js';

export interface SearchHit {
  type: 'task' | 'project' | 'bug' | 'incident' | 'document';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const RESULTS_PER_TYPE = 5;

/**
 * Cross-entity search across tasks, projects, bugs, incidents, and documents,
 * scoped to the caller's organization. ILIKE across a handful of key columns
 * per table — no FTS infra exists yet in this schema, and adding one is out
 * of scope for a search-bar feature. `includeDocuments` lets callers respect
 * `document:view` separately from the coarser `task:view` gate the rest of
 * search sits behind.
 */
export async function globalSearch(
  supabase: SupabaseClient,
  orgId: string,
  query: string,
  opts: { includeDocuments: boolean },
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  // PostgREST's `.or()` mini-language uses `,`/`(`/`)` as clause separators —
  // strip them so a query containing those characters can't break or
  // reshape the filter (in addition to the existing %/_ ILIKE-wildcard
  // escaping below). This only affects the `.or()`-built patterns for
  // tasks/projects; the single-column `.ilike()` calls below aren't
  // susceptible, but stripping up front keeps the same pattern everywhere.
  const safeQ = q.replace(/[,()]/g, '');
  const pattern = `%${safeQ.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  const [tasks, projects, bugs, incidents, documents] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, task_key, title, project:project_id(code)')
      .eq('organization_id', orgId)
      .is('archived_at', null)
      .or(`title.ilike.${pattern},task_key.ilike.${pattern}`)
      .limit(RESULTS_PER_TYPE),

    supabase
      .from('projects')
      .select('id, name, code')
      .eq('organization_id', orgId)
      .or(`name.ilike.${pattern},code.ilike.${pattern}`)
      .limit(RESULTS_PER_TYPE),

    supabase
      .from('bugs')
      .select('id, title, project:project_id(code)')
      .eq('organization_id', orgId)
      .ilike('title', pattern)
      .limit(RESULTS_PER_TYPE),

    supabase
      .from('incidents')
      .select('id, title, severity, status')
      .eq('organization_id', orgId)
      .ilike('title', pattern)
      .limit(RESULTS_PER_TYPE),

    opts.includeDocuments
      ? supabase
          .from('documents')
          .select('id, title, document_type')
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .ilike('title', pattern)
          .limit(RESULTS_PER_TYPE)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const hits: SearchHit[] = [];

  type TaskRow = { id: string; task_key: string; title: string; project?: { code?: string } | { code?: string }[] | null };
  for (const t of (tasks.data ?? []) as TaskRow[]) {
    const projectCode = Array.isArray(t.project) ? t.project[0]?.code : t.project?.code;
    hits.push({
      type: 'task', id: t.id, title: t.title,
      subtitle: [t.task_key, projectCode].filter(Boolean).join(' · '),
      href: `/dashboard/tasks?task=${t.id}`,
    });
  }

  type ProjectRow = { id: string; name: string; code: string };
  for (const p of (projects.data ?? []) as ProjectRow[]) {
    hits.push({ type: 'project', id: p.id, title: p.name, subtitle: p.code, href: `/dashboard/projects/${p.id}` });
  }

  type BugRow = { id: string; title: string; project?: { code?: string } | { code?: string }[] | null };
  for (const b of (bugs.data ?? []) as BugRow[]) {
    const projectCode = Array.isArray(b.project) ? b.project[0]?.code : b.project?.code;
    hits.push({
      type: 'bug', id: b.id, title: b.title,
      subtitle: projectCode ? `Bug · ${projectCode}` : 'Bug',
      href: `/dashboard/qa-security/bugs/${b.id}`,
    });
  }

  type IncidentRow = { id: string; title: string; severity: string; status: string };
  for (const i of (incidents.data ?? []) as IncidentRow[]) {
    hits.push({
      type: 'incident', id: i.id, title: i.title,
      subtitle: `${i.severity} · ${i.status}`,
      href: `/dashboard/incidents/${i.id}`,
    });
  }

  type DocumentRow = { id: string; title: string; document_type: string };
  for (const d of (documents.data ?? []) as DocumentRow[]) {
    hits.push({
      type: 'document', id: d.id, title: d.title,
      subtitle: d.document_type,
      href: `/dashboard/documents`,
    });
  }

  return hits;
}
