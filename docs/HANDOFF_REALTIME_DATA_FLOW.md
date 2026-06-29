# Handoff — Realtime Data Flow

End-to-end trace of each core collaboration action: UI → API → permission → DB tables → audit → notification → realtime → UI surfaces updated. Reflects the **actual implementation** (verified against code + live browser/API), not aspiration.

## Conventions / ground truth
- **Actor is never trusted from the client.** The actor member is derived server-side: API routes resolve it via `requireOrganization()` (auth session → `organization_members`), and the `create_notification` SQL function resolves the actor from `auth.uid()`. The frontend may submit an *assignee* ID, but it is validated (see Assignment).
- **Boundaries:** every row carries `organization_id` (company) and, where relevant, `project_id`. RLS enforces both.
- **Realtime transport:** Supabase Postgres Changes subscriptions (not broadcast). Channel name constants live in `lib/realtime/channels.ts` (`organization:{id}`, `project:{id}`, `task:{id}`, `user:{memberId}`); presence uses `task:{id}`.
- **Notification self-skip:** `create_notification` returns null if actor == recipient (you are not notified about your own actions).

---

## Flow 1 — Project Manager / Admin creates & assigns a task  ✅ WORKING

```
UI: Create Task modal (components/tasks/create-task-modal.tsx) → "Create Task"
→ POST /api/v1/tasks
→ permission: requirePermission('task:create'); if assignee present also requirePermission('task:assign')
→ validation: createTaskSchema (Zod) + assertAssignable(orgId, project_id, assignee)
     · assignee must be active, non-suspended, in project_members ∪ project_teams→team_members,
       not a Client Viewer, same org  (services/member.service.ts)
     · optional epic_id is project-scoped (picker fed by GET /api/v1/projects/:id/epics,
       RLS epics_select → can_view_project)
→ DB writes:
     · tasks                     (insert; organization_id + reporter_member_id from session)
     · task_assignees            (insert active PRIMARY assignment history row)
     · task_activity             (trigger handoff.log_task_change on later updates; create logs audit)
     · audit_logs                (action 'task.created')
→ notification:
     · trigger handoff.notify_task_assigned (AFTER INSERT task_assignees)
       → create_notification(... 'TASK_ASSIGNED', 'You were assigned to UPI-116', title, project_id)
       → notifications (insert; recipient_member_id = assignee, actor from auth.uid())
→ realtime:
     · notifications postgres_changes (filter recipient_member_id) → assignee's bell/Inbox
     · tasks postgres_changes for project → manager's Kanban (use-board-realtime)
→ UI updated WITHOUT refresh:
     · Employee: My Work (tasks?mine=true), Inbox, notification count
     · Manager:  Project Board (new card)
```
**Verified:** pm@ created UPI-116 → dev@ received `TASK_ASSIGNED`, saw it in My Work. Ineligible assignee (Client Viewer / out-of-scope) → 422; non-assigner (dev@) → 403.

---

## Flow 2 — Reassign an existing task  ✅ WORKING

```
UI: Task Drawer assignee select (data-testid="task-assignee-select"), shown only if has('task:assign')
→ PATCH /api/v1/tasks/:taskId  { primary_assignee_member_id }
→ permission: requirePermission('task:update'); assignee present → requirePermission('task:assign')
→ validation: assertAssignable(orgId, task.project_id, assignee)  (re-fetches task's project)
→ DB writes:
     · tasks (update primary_assignee_member_id)
     · task_assignees (old PRIMARY row gets removed_at; new PRIMARY row inserted/promoted)
       → fires notify_task_assigned for new active assignments → notifications
     · task_activity ('assignee_changed' via trigger log_task_change)
     · audit_logs ('task.updated')
→ realtime: notifications → new assignee; tasks changes → boards/drawers
```

Private-task note: task rows and task-adjacent rows now use `handoff.can_view_task(...)` RLS. Project membership alone does not reveal private tasks.

---

## Flow 3 — Employee updates task status  ✅ WORKING

```
UI: Task Drawer status select (data-testid="task-status-select")  OR  Kanban drag
→ PATCH /api/v1/tasks/:taskId  { status }
→ permission: requirePermission('task:update')   (employee/DEVELOPER has it for own work)
→ DB writes:
     · tasks (update status)
     · task_activity ('status_changed' via trigger)  — actor from auth.uid()
     · audit_logs ('task.updated')
→ realtime: tasks postgres_changes for project → Manager board card moves; drawer refresh
→ UI updated: Manager Project Board, dashboards reading task status
```
**Verified:** dev@ PATCH status → IN_PROGRESS (200).

---

## Flow 4 — Comment + @mention  ✅ WORKING

```
UI: Task Drawer @mention picker (data-testid="comment-mention-select") → chips → comment input
    (comment-input) → Send (comment-submit-button)
→ POST /api/v1/tasks/:taskId/comments  { body, mentions: [member_id…] }
→ permission: requirePermission('comment:create')
→ DB writes:
     · task_comments (insert; author_member_id from session, sanitized body)
     · comment_mentions (insert per mention, self-filtered)
     · notifications (TASK_MENTIONED per mention; actor from auth.uid(); metadata.comment_id)
     · audit_logs ('comment.created')
→ realtime:
     · task_comments postgres_changes (use-task-realtime) → drawer thread (author name + job title shown)
     · notifications postgres_changes (recipient_member_id) → mentioned user's bell/Inbox
→ deep-link: notification carries entity_id (task) + metadata.comment_id → opens exact task/comment
```
**Verified:** pm@ commented "@Dev Rao …" on UPI-122 → dev@ received `TASK_MENTIONED` "You were mentioned on UPI-122" with task + comment IDs; author rendered "Pat Manager · Senior Project Manager".

### Flow 4b — Edit / soft-delete / reply to a comment  ✅ WORKING

```
UI: Task Drawer comment actions (own comment only): Edit / Delete / Reply
Edit   → PATCH  /api/v1/tasks/:taskId/comments/:commentId  { body }
         → requirePermission('comment:update_own'); service re-checks author; RLS comments_update_own
         → task_comments.update(body, edited_at) ; audit_logs('comment.updated')
         → realtime: task_comments postgres_changes (use-task-realtime) → thread shows "· edited"
Delete → DELETE /api/v1/tasks/:taskId/comments/:commentId   (soft-delete)
         → requirePermission('comment:delete_own'); author re-check; RLS comments_update_own
         → task_comments.update(deleted_at) — row kept so replies survive; renders "[deleted]"
         → audit_logs('comment.deleted')
Reply  → POST /api/v1/tasks/:taskId/comments  { body, parent_comment_id }
         → nested under parent in the drawer (one level)
```
**Verified live (admin@):** edited → "· edited" (DB `edited_at`); deleted → "[deleted]" (DB `deleted_at`); reply nested (DB `parent_comment_id`). Ownership covered by `tests/integration/comment-edit-delete.test.ts` (non-author update → 0 rows).

> Still open (Audit C follow-up): per-comment attachments (task-level attachments already work); two-window realtime click-through (subscriptions verified in code + live single-session tests).

---

## Flow 5 — Inbox counts / unread badge  ✅ WORKING (de-fake pass)

```
UI: Inbox (app/dashboard/inbox/page.tsx) + NotificationBell
→ GET /api/v1/notifications
→ listNotifications(memberId) (services/notification.service.ts)
     · items   = recipient's non-archived notifications (limit 100)
     · counts  = aggregated from the SAME org-scoped query (recipient + not archived):
                 { all, unread, mentions, approvals, task_updates, pull_requests,
                   release_alerts, incident_alerts, qa_security, ai, system }
       grouping via lib/constants/notification-categories.ts categoryOf() — the
       client filters the visible list with the SAME mapping, so badges / ALL /
       UNREAD / MENTIONS / rows can never contradict.
→ realtime: notifications postgres_changes (filter recipient_member_id)
     · use-notifications-realtime → Inbox.load() + NotificationBell.load()
→ UI without refresh: category badges, unread bell badge, list — all from one counts object.
```
**Verified:** `tests/integration/de-fake-pass.test.ts` (count consistency + post-insert invariant); live notification event in `scripts/verify-realtime.mjs`.

## Flow 6 — Overview Intelligence Feed  ✅ WORKING (de-fake pass)

```
UI: Command Center (app/dashboard/page.tsx), analytics:view users only
→ GET /api/v1/dashboard/overview → getOverview(orgId)
     · signals[]       = real counts (open incidents, overdue/blocked tasks, critical bugs,
                          open security findings, pending approvals, projects at risk) — empty ⇒ truthful empty state
     · priorityItems[] = real blocked+overdue tasks (assignee name) + open incidents (commander name)
     · velocity[]      = completed sprints' completed_story_points
     · workload[]      = open tasks grouped by project code
→ realtime: useTablesRealtime(['tasks','incidents','approval_requests','bugs']) → re-fetch overview
```

## Flow 7 — My Work  ✅ WORKING (de-fake pass)

```
UI: My Work (app/dashboard/my-work/page.tsx)
→ GET /api/v1/my-work → getMyWork(orgId, memberId)
     · tasks (RLS-visible private-task set) — single source for KPIs + table + "Showing X–Y of Z"
     · kpis, blockers (status=BLOCKED), upcoming (due ≤ 7d), recentActivity (task_activity on my tasks),
       sprint (my most-active active sprint), approvals (PENDING approval_requests, RLS-scoped)
     · AI Daily Brief HIDDEN until it can cite authorized real data
→ realtime: useTablesRealtime(['tasks','task_assignees','task_activity','notifications']) → re-fetch
```
**Verified:** pagination/KPI consistency in `tests/integration/de-fake-pass.test.ts`.

## Flow 8 - Group A action buttons (backend-connected, browser verification pending)

### Add Deadline

```
UI: AddDeadlineModal (components/dashboard/add-deadline-modal.tsx)
-> POST /api/v1/project-deadlines
-> permission: requirePermission('deadline:create') or requirePermission('project:update')
-> validation: createProjectDeadlineSchema
-> DB writes:
     - project_deadlines (organization_id + created_by_member_id from session)
     - project_activity ('deadline_created')
     - audit_logs ('deadline.created')
     - notifications (optional owner reminder when owner_member_id is set)
-> realtime:
     - Calendar subscribes to tasks + project_deadlines through useTablesRealtime()
     - owner notification uses the existing notifications subscription
```

### Project CSV import

```
UI: ImportProjectsModal (components/dashboard/import-projects-modal.tsx)
-> POST /api/v1/projects/imports/preview (multipart CSV)
-> permission: requirePermission('project:import')
-> CSV parse + mapping guess + row validation
-> DB writes:
     - import_jobs
     - import_rows
-> POST /api/v1/projects/imports/[importId]/confirm
-> permission: requirePermission('project:import')
-> DB writes:
     - valid rows inserted into projects through the trusted admin client
     - import_jobs status/summary updated
     - audit_logs ('projects.imported')
-> realtime:
     - project list refreshes after confirm; projects table is already in realtime publication
```

### Project and sprint CSV export

```
UI: ExportReportModal (components/dashboard/export-report-modal.tsx)
-> GET /api/v1/projects/export or GET /api/v1/sprints/export
-> permission: requirePermission('report:export') for projects;
              report:export or sprint:view for sprints
-> validation: exportFormatSchema
-> DB writes:
     - report_exports
     - audit_logs ('report.exported')
-> response:
     - CSV attachment with authorized, org-scoped rows only
     - PDF currently returns a truthful validation error instead of fake output
```

**Verified this pass:** lint, typecheck, unit tests, targeted Group A integration (6/6), production build, and Supabase migration reset. Browser persistence/realtime walkthrough is still pending, so these remain PARTIAL in `docs/HANDOFF_ACTIONS_BACKEND_AUDIT.md`.

## Realtime channels / subscriptions in use
| Surface | Hook | Subscription |
|---------|------|--------------|
| Kanban board | `use-board-realtime` | `tasks` changes for project |
| Task drawer | `use-task-realtime` | `tasks` + `task_comments` for task |
| Notification bell / Inbox | `use-notifications-realtime` | `notifications` filtered `recipient_member_id` |
| Overview (Command Center) | `use-tables-realtime` | `tasks`, `incidents`, `approval_requests`, `bugs` |
| My Work | `use-tables-realtime` | `tasks`, `task_assignees`, `task_activity`, `notifications` |
| Task presence | `use-presence` | channel `task:{id}` (presence) |

## Flow — AI citation → governance record detail surface  ✅ WORKING

Every AI insight/answer cites real rows by id; each citation is now a clickable link to a stable, org-scoped detail route (also usable by notifications, audit links, browser history, and intra-org sharing).

```
UI: AiPanel / AI Daily Brief renders sources → sourceHref(source) (lib/ai/source-href.ts)
    type → route:  task→/dashboard/tasks/[id]  project→/dashboard/projects/[id]
                   incident→/dashboard/incidents/[id]  bug→/dashboard/qa-security/bugs/[id]
                   security_review→/dashboard/qa-security/security-reviews/[id]
                   release→/dashboard/releases/[id]  approval_request→/dashboard/approvals/[id]
→ Detail route (server component) → loadDetail({ table, id, select, permission }) (lib/dashboard/load-detail.ts)
     1. getCurrentMembership() → not a member ⇒ 403 (EntityForbidden), no record read
     2. hasPermission(m, permission) → bug:qa:view · security_review:security:view ·
        release:release:view · approval_request:approval:view · task:task:view · incident:(membership only)
        → lacks it ⇒ 403 before fetch (no metadata leak)
     3. fetch .eq('id', id).eq('organization_id', m.organizationId).maybeSingle()
        → foreign-org id or missing/malformed id ⇒ null ⇒ 404 (EntityNotFound); never reveals data
→ Render EntityDetailLayout (components/dashboard/entity-detail-layout.tsx):
     title/status/severity/priority/owner/timestamps, breadcrumb to queue, linked
     project/task/release (clickable, RLS-resolved), real Activity Timeline (record
     timestamps; incidents use real incident_timeline_events), loading/empty/403/404 states.
```
- **No realtime subscription** on these read-only governance detail pages (server-rendered per request); they are not collaborative-edit surfaces. Data is always live (fetched server-side on navigation).
- **No fabricated data:** every field comes from the real row or is omitted; unresolved member ids fall back to a neutral label, never invented.
- **Verified:** `tests/unit/source-href.test.ts` (route mapping), `tests/integration/entity-detail-access.test.ts` (authorized open, cross-org isolation, 404 missing, 403 gate for all 7 types). Browser: QA & Security Digest bug/security-review citations clickable → real bug page (UPI Data Race in Worker) + release page (Compliance Gate v9.8); 404 state confirmed.

## Spec deltas (documented, not yet built)
- Spec names a `member:{organizationMemberId}` channel; implementation notifies via `notifications` table subscription instead (equivalent effect).
- Additional assignees are surfaced in the create UI and write active assignment rows; reviewer/observer roles use the same `task_assignees` history model.
