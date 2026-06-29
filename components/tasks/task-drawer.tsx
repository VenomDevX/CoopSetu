'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Paperclip } from 'lucide-react';
import { useTaskRealtime } from '@/hooks/use-task-realtime';
import { usePresence } from '@/hooks/use-presence';
import { channels } from '@/lib/realtime/channels';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/permissions/context';
import { TASK_STATUSES, TASK_VISIBILITY_SCOPES } from '@/lib/constants/task-statuses';
import { AskAiButton } from '@/components/ai/ask-ai-button';

interface Comment {
  id: string;
  body: string;
  author_member_id: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  parent_comment_id?: string | null;
  author?: {
    id: string;
    profile?: { full_name: string | null; email: string | null; job_title: string | null }
      | { full_name: string | null; email: string | null; job_title: string | null }[] | null;
  } | null;
}
interface DirectoryMember {
  id: string;
  name: string;
  job_title: string | null;
}
interface Attachment {
  id: string;
  file_name: string;
  size_bytes: number | null;
  url: string | null;
}
interface AssignmentMember {
  id: string;
  profile?: { full_name: string | null; email: string | null; job_title?: string | null }
    | { full_name: string | null; email: string | null; job_title?: string | null }[] | null;
}
interface TaskAssignment {
  id: string;
  organization_member_id: string;
  assignment_role: string | null;
  assignment_type: string | null;
  assigned_at: string;
  removed_at: string | null;
  assigned_member?: AssignmentMember | AssignmentMember[] | null;
  assigned_by_member?: AssignmentMember | AssignmentMember[] | null;
  removed_by_member?: AssignmentMember | AssignmentMember[] | null;
}
interface TaskDetail {
  id: string;
  task_key: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  visibility_scope: string;
  organization_id: string;
  project_id: string | null;
  primary_assignee_member_id: string | null;
  task_assignees?: TaskAssignment[] | null;
}
interface AssignableMember {
  member_id: string;
  full_name: string;
  job_title: string | null;
  team_name: string | null;
  role: string | null;
  capacity_percent: number | null;
}

export function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [body, setBody] = useState('');
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);
  const [pendingMentions, setPendingMentions] = useState<DirectoryMember[]>([]);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [self, setSelf] = useState<{ memberId: string; name: string } | null>(null);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [savingField, setSavingField] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { has } = usePermission();
  const canAssign = has('task:assign');
  const canEdit = has('task:update');
  const canEditOwn = has('comment:update_own');
  const canDeleteOwn = has('comment:delete_own');

  const load = useCallback(() => {
    fetch(`/api/v1/tasks/${taskId}`).then((r) => r.json()).then((j) => j?.data && setTask(j.data));
    fetch(`/api/v1/tasks/${taskId}/comments`).then((r) => r.json()).then((j) => setComments(Array.isArray(j?.data) ? j.data : []));
    fetch(`/api/v1/tasks/${taskId}/attachments`).then((r) => r.json()).then((j) => setAttachments(Array.isArray(j?.data) ? j.data : []));
  }, [taskId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/v1/organizations/current').then((r) => r.json()).then((j) => {
      const mem = j?.data?.membership;
      if (mem) setSelf({ memberId: mem.memberId, name: 'You' });
    });
  }, []);

  useEffect(() => {
    if (!canAssign || !task?.project_id) return;
    let active = true;
    fetch(`/api/v1/projects/${task.project_id}/assignable-members`)
      .then((r) => r.json())
      .then((j) => { if (active) setMembers(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => {});
    return () => { active = false; };
  }, [canAssign, task?.project_id]);

  // Member directory for @mentions + author fallback (org members, member:view).
  useEffect(() => {
    let active = true;
    fetch('/api/v1/employees')
      .then((r) => r.json())
      .then((j) => {
        if (!active || !Array.isArray(j?.data)) return;
        setDirectory(j.data.map((m: { id: string; profile: { full_name?: string; email?: string; job_title?: string } | { full_name?: string; email?: string; job_title?: string }[] | null }) => {
          const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
          return { id: m.id, name: p?.full_name ?? p?.email ?? 'Member', job_title: p?.job_title ?? null };
        }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useTaskRealtime(taskId, load);
  const present = usePresence(channels.task(taskId), self);

  function authorName(c: Comment): string {
    const p = c.author?.profile;
    const prof = Array.isArray(p) ? p[0] : p;
    if (prof?.full_name) return prof.full_name;
    return directory.find((d) => d.id === c.author_member_id)?.name ?? 'Member';
  }
  function authorTitle(c: Comment): string | null {
    const p = c.author?.profile;
    const prof = Array.isArray(p) ? p[0] : p;
    return prof?.job_title ?? directory.find((d) => d.id === c.author_member_id)?.job_title ?? null;
  }
  function memberName(member?: AssignmentMember | AssignmentMember[] | null): string {
    const m = Array.isArray(member) ? member[0] : member;
    const p = m?.profile;
    const prof = Array.isArray(p) ? p[0] : p;
    return prof?.full_name ?? prof?.email ?? 'Member';
  }
  function assignmentLine(a: TaskAssignment): string {
    const assignedBy = a.assigned_by_member ? ` by ${memberName(a.assigned_by_member)}` : '';
    const removedBy = a.removed_at
      ? ` - removed${a.removed_by_member ? ` by ${memberName(a.removed_by_member)}` : ''}`
      : ' - active';
    return `${a.assignment_type ?? a.assignment_role ?? 'ASSIGNEE'} - ${memberName(a.assigned_member)}${assignedBy}${removedBy}`;
  }
  function addMention(id: string) {
    const m = directory.find((d) => d.id === id);
    if (!m || pendingMentions.some((p) => p.id === id)) return;
    setPendingMentions((prev) => [...prev, m]);
    setBody((b) => (b ? `${b} @${m.name} ` : `@${m.name} `));
  }

  async function patchTask(patch: Record<string, unknown>, field: string) {
    setSavingField(field);
    const res = await fetch(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSavingField(null);
    if (res.ok) load();
  }

  function memberLabel(m: AssignableMember) {
    const parts = [m.full_name, m.job_title, m.team_name, m.role,
      m.capacity_percent != null ? `${m.capacity_percent}%` : null].filter(Boolean);
    return parts.join(' · ');
  }

  async function postComment() {
    if (!body.trim()) return;
    const mentions = pendingMentions.map((m) => m.id);
    const res = await fetch(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        body: body.trim(),
        ...(mentions.length ? { mentions } : {}),
        ...(replyTo ? { parent_comment_id: replyTo.id } : {}),
      }),
    });
    if (res.ok) { setBody(''); setPendingMentions([]); setReplyTo(null); load(); }
  }

  async function saveEdit(id: string) {
    if (!editBody.trim()) return;
    const res = await fetch(`/api/v1/tasks/${taskId}/comments/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: editBody.trim() }),
    });
    if (res.ok) { setEditingId(null); setEditBody(''); load(); }
  }

  async function removeComment(id: string) {
    const res = await fetch(`/api/v1/tasks/${taskId}/comments/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  const isOwn = (c: Comment) => !!self && c.author_member_id === self.memberId;

  function renderComment(c: Comment) {
    const deleted = !!c.deleted_at;
    const editing = editingId === c.id;
    return (
      <div key={c.id} data-testid="comment-item" className="border border-border p-3 bg-surface">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-bold">
            {authorName(c)}
            {authorTitle(c) && <span className="font-normal text-muted-foreground"> · {authorTitle(c)}</span>}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {new Date(c.created_at).toLocaleString()}{c.edited_at && !deleted ? ' · edited' : ''}
          </div>
        </div>

        {deleted ? (
          <div className="text-sm italic text-muted-foreground">[deleted]</div>
        ) : editing ? (
          <div className="space-y-2">
            <textarea
              data-testid="comment-edit-input"
              value={editBody} onChange={(e) => setEditBody(e.target.value)}
              rows={2} className="w-full px-2 py-1 bg-background border border-border text-sm"
            />
            <div className="flex gap-2">
              <button data-testid="comment-edit-save" onClick={() => saveEdit(c.id)}
                className="h-7 px-3 bg-foreground text-background text-[10px] font-mono uppercase tracking-widest">Save</button>
              <button onClick={() => { setEditingId(null); setEditBody(''); }}
                className="h-7 px-3 border border-border text-[10px] font-mono uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm whitespace-pre-wrap">{c.body}</div>
            <div className="flex items-center gap-3 mt-2">
              {!c.parent_comment_id && (
                <button data-testid="comment-reply-button" onClick={() => { setReplyTo(c); setBody(''); }}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">Reply</button>
              )}
              {isOwn(c) && canEditOwn && (
                <button data-testid="comment-edit-button" onClick={() => { setEditingId(c.id); setEditBody(c.body); }}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">Edit</button>
              )}
              {isOwn(c) && canDeleteOwn && (
                <button data-testid="comment-delete-button" onClick={() => removeComment(c.id)}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-red-500">Delete</button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  async function uploadFile(file: File) {
    if (!task) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${task.organization_id}/task/${taskId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file);
      if (upErr) throw upErr;
      await fetch(`/api/v1/tasks/${taskId}/attachments`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      });
      load();
    } catch {
      // swallow; UI stays usable
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div data-testid="task-drawer" className="w-full max-w-lg h-[100dvh] bg-background border-l border-border flex flex-col animate-in slide-in-from-right-8 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {task?.task_key ?? 'Task'}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1">
              {present.map((p) => (
                <div key={p.memberId} title={p.name}
                  className="w-6 h-6 rounded-full bg-foreground text-background text-[9px] flex items-center justify-center border border-background">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
            <button data-testid="task-drawer-close" onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <h2 className="text-lg font-bold">{task?.title}</h2>
          {has('ai:use') && has('task:view') && (
            <div className="flex flex-wrap gap-2">
              <AskAiButton
                intent="summarize-task"
                taskId={taskId}
                permission="task:view"
                label="Summarize Task"
                title="Task Summary"
                className="h-8 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border text-accent hover:bg-accent/10 gap-2"
              />
              <AskAiButton
                intent="task-plan"
                taskId={taskId}
                permission="task:view"
                label="Task Plan Generation"
                title="Draft Plan"
                className="h-8 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border text-accent hover:bg-accent/10 gap-2"
              />
              <AskAiButton
                intent="summarize-comments"
                taskId={taskId}
                permission="task:view"
                label="Summarize Discussion"
                title="Discussion Summary"
                className="h-8 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border text-accent hover:bg-accent/10 gap-2"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Status</label>
              {canEdit ? (
                <select
                  data-testid="task-status-select"
                  value={task?.status ?? ''}
                  disabled={savingField === 'status'}
                  onChange={(e) => patchTask({ status: e.target.value }, 'status')}
                  className="w-full h-9 px-2 bg-background border border-border text-xs font-mono uppercase"
                >
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span className="border border-border px-2 py-1 font-mono text-[10px] uppercase inline-block">{task?.status}</span>
              )}
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Priority</label>
              <span className="border border-border px-2 py-1 font-mono text-[10px] uppercase inline-block">{task?.priority}</span>
            </div>
          </div>

          {canAssign && (
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">
                Assignee {members.length > 0 && `(${members.length} eligible)`}
              </label>
              <select
                data-testid="task-assignee-select"
                value={task?.primary_assignee_member_id ?? ''}
                disabled={savingField === 'assignee'}
                onChange={(e) => patchTask({ primary_assignee_member_id: e.target.value || null }, 'assignee')}
                className="w-full h-9 px-2 bg-background border border-border text-xs"
              >
                <option value="">— Unassigned —</option>
                {members.map((m) => <option key={m.member_id} value={m.member_id}>{memberLabel(m)}</option>)}
              </select>
            </div>
          )}
          {canEdit && (
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Visibility</label>
              <select
                value={task?.visibility_scope ?? 'PRIVATE_ASSIGNMENT'}
                disabled={savingField === 'visibility'}
                onChange={(e) => patchTask({ visibility_scope: e.target.value }, 'visibility')}
                className="w-full h-9 px-2 bg-background border border-border text-xs font-mono uppercase"
              >
                {TASK_VISIBILITY_SCOPES.map((scope) => <option key={scope} value={scope}>{scope.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
          {task?.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>}

          <div className="pt-4 border-t border-border">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              Assignments ({task?.task_assignees?.length ?? 0})
            </div>
            <div className="space-y-2">
              {(task?.task_assignees ?? []).map((a) => (
                <div key={a.id} className="border border-border p-2 bg-surface">
                  <div className="text-xs">{assignmentLine(a)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">
                    {new Date(a.assigned_at).toLocaleString()}
                    {a.removed_at ? ` -> ${new Date(a.removed_at).toLocaleString()}` : ''}
                  </div>
                </div>
              ))}
              {(task?.task_assignees ?? []).length === 0 && <p className="text-xs text-muted-foreground font-mono">No assignment history.</p>}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Attachments ({attachments.length})
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50">
                <Paperclip className="w-3 h-3" /> {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <input ref={fileRef} type="file" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
            </div>
            <div className="space-y-2">
              {attachments.map((a) => (
                <a key={a.id} href={a.url ?? '#'} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 border border-border p-2 bg-surface hover:bg-surface-hover text-xs">
                  <Paperclip className="w-3 h-3 text-muted-foreground" />
                  <span className="flex-1 truncate">{a.file_name}</span>
                  {a.size_bytes != null && <span className="font-mono text-[10px] text-muted-foreground">{Math.ceil(a.size_bytes / 1024)} KB</span>}
                </a>
              ))}
              {attachments.length === 0 && <p className="text-xs text-muted-foreground font-mono">No attachments.</p>}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              Comments ({comments.length})
            </div>
            <div className="space-y-3">
              {comments.filter((c) => !c.parent_comment_id).map((c) => (
                <div key={c.id} className="space-y-2">
                  {renderComment(c)}
                  {comments.filter((r) => r.parent_comment_id === c.id).length > 0 && (
                    <div className="ml-5 pl-3 border-l border-border space-y-2">
                      {comments.filter((r) => r.parent_comment_id === c.id).map((r) => renderComment(r))}
                    </div>
                  )}
                </div>
              ))}
              {comments.length === 0 && <p className="text-xs text-muted-foreground font-mono">No comments yet.</p>}
            </div>
          </div>
        </div>

        {replyTo && (
          <div className="px-4 pt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>Replying to {authorName(replyTo)}</span>
            <button onClick={() => setReplyTo(null)} className="hover:text-foreground">Cancel reply ×</button>
          </div>
        )}
        <div className="px-4 pt-3 border-t border-border flex flex-wrap items-center gap-2">
          {directory.length > 0 && (
            <select
              data-testid="comment-mention-select"
              value=""
              onChange={(e) => { if (e.target.value) addMention(e.target.value); }}
              className="h-8 px-2 bg-surface border border-border text-[11px] font-mono"
            >
              <option value="">@ Mention…</option>
              {directory.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {pendingMentions.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-[10px] font-mono bg-surface">
              @{m.name}
              <button onClick={() => setPendingMentions((prev) => prev.filter((p) => p.id !== m.id))} className="text-muted-foreground hover:text-foreground">×</button>
            </span>
          ))}
        </div>
        <div className="px-4 pb-4 pt-2 flex gap-2">
          <input
            data-testid="comment-input"
            value={body} onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && postComment()}
            placeholder="WRITE A COMMENT…"
            className="flex-1 h-10 px-3 bg-surface border border-border text-sm"
          />
          <button data-testid="comment-submit-button" onClick={postComment} className="h-10 px-4 bg-foreground text-background text-xs font-mono uppercase tracking-widest">Send</button>
        </div>
      </div>
    </div>
  );
}
