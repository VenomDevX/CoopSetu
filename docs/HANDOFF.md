# Handoff — Project Documentation

Unified documentation for the Handoff enterprise project management platform.

---

## Table of Contents

1. [Local Development](#1-local-development)
2. [Architecture](#2-architecture)
   - [Permissions & RLS](#permissions--rls)
   - [Realtime](#realtime)
3. [API Reference](#3-api-reference)
4. [Security](#4-security)
   - [Security Hardening Plan](#security-hardening-plan)
   - [Security Audit](#security-audit)
5. [Private Task Visibility](#5-private-task-visibility)
6. [Functional Audit](#6-functional-audit)
7. [Responsive Audit](#7-responsive-audit)
8. [Testing](#8-testing)
9. [Implementation Tracker](#9-implementation-tracker)

---

# 1. Local Development

Handoff runs fully locally against a Dockerized Supabase stack. No cloud, Git,
deployment, or external API credentials are required.

## 1.1 Required software

- Node.js 20+
- Docker Desktop (running)
- The Supabase CLI is installed as a dev dependency (`npx supabase ...`)

## 1.2 Start Docker Desktop

Make sure the Docker daemon is running before starting Supabase.

## 1.3 Install dependencies

```bash
npm install
```

## 1.4 Initialise / start local Supabase

The project is already initialised (`supabase/config.toml`, `project_id = "handoff"`).
Start the stack:

```bash
npx supabase start
```

First run pulls Docker images (several minutes). When it finishes it prints the
local keys. The publishable key is already wired into `.env.local`.

## 1.5 Environment variables (`.env.local`)

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # from `supabase start`
HANDOFF_AI_MODE=mock
HANDOFF_ENABLE_MOCK_INTEGRATIONS=true
HANDOFF_ENABLE_DEV_SEED=true
SUPABASE_SECRET_KEY=sb_secret_...                         # server only, never NEXT_PUBLIC_
```

If `supabase start` printed different keys, copy `PUBLISHABLE_KEY` and
`SECRET_KEY` into `.env.local`.

## 1.6 Apply migrations + seed

```bash
npx supabase db reset
```

This drops the local DB, re-applies every migration in `supabase/migrations`,
then loads `supabase/seed.sql` (demo org + users).

## 1.7 Run the app

```bash
npm run dev
```

## 1.8 Local URLs

| Service        | URL                          |
| -------------- | ---------------------------- |
| App            | http://localhost:3000        |
| Supabase API   | http://127.0.0.1:54321       |
| Studio         | http://127.0.0.1:54323       |
| Mailpit (mail) | http://127.0.0.1:54324       |
| Postgres       | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

## 1.9 Demo user credentials

All demo accounts use password **`Password123!`**. The login page also has
one-click buttons for the first four.

| Role             | Email                     |
| ---------------- | ------------------------- |
| Org Owner        | owner@apexfintech.test    |
| Org Admin        | admin@apexfintech.test    |
| Project Manager  | pm@apexfintech.test       |
| Team Manager     | tm@apexfintech.test       |
| Developer        | dev@apexfintech.test      |
| QA Engineer      | qa@apexfintech.test       |
| Security Engineer| sec@apexfintech.test      |
| Auditor          | audit@apexfintech.test    |
| Client Viewer    | client@apexfintech.test   |

All belong to the **Apex Financial Technologies** organization.

## 1.10 Sign-up / onboarding

A brand-new sign-up (`/signup`) has no organization and is redirected to
`/onboarding`, where creating an org makes the user that org's `ORG_ADMIN`.

## 1.11 Stop local Supabase

```bash
npx supabase stop
```

Local data is preserved in a Docker volume between stops; `db reset` wipes it.

## 1.12 Public Demo Workspace

Handoff includes a zero-friction public demo workspace. Visitors can explore the app instantly via the **Explore Demo** button on the sign-in/up pages.

- **Authentication**: Uses Supabase Anonymous Auth. Visitors do not need an email or password.
- **Data Isolation**: A real organization is created behind the scenes with `is_demo = true`. The anonymous user is added as a member. Existing RLS policies enforce isolation automatically.
- **Role Switching**: Demo users can switch between personas (Admin, Manager, Developer, QA, Security) to experience different UI states and permissions.
- **Restrictions**: In demo organizations, AI (Gemini), external integrations, webhooks, exports, and real file uploads are disabled or hidden in the UI.
- **Cleanup**: Demo sessions expire automatically (e.g. 4 hours). A Vercel cron job calls `GET /api/v1/demo/cleanup` to permanently delete expired demo organizations and their anonymous auth users.

---

# 2. Architecture

## Permissions & RLS

### Model

- **Roles** (`roles`): system roles (`organization_id IS NULL`) seeded once, plus
  optional custom org roles. A member can hold multiple roles (`member_roles`).
- **Permissions** (`permissions`): fine-grained codes like `task:create`,
  `release:approve`. Roles map to permissions via `role_permissions`.
- **ORG_ADMIN** and **SUPER_ADMIN** implicitly have every permission.

### Enforcement layers (defense in depth)

1. **Database RLS** — the source of truth. Every business table has RLS enabled.
   Policies call `SECURITY DEFINER` helper functions in the `handoff` schema:
   - `handoff.is_org_member(org)` — active membership check
   - `handoff.has_permission(org, code)` — role/permission check (admins = all)
   - `handoff.has_role(org, codes[])`
   - `handoff.can_view_project(project)` / `can_manage_project` / `is_project_member`
   - `handoff.can_edit_task(task)` — managers, or the assignee
   These are `SECURITY DEFINER` to avoid policy recursion on their own tables.
2. **API guards** — `requireUser`, `requireOrganization`, `requirePermission`
   reject early with `401`/`403` before touching the DB.
3. **UI gating** — the membership's flat permission list (`member_permissions`
   RPC) hides actions the user can't perform. Cosmetic only; never trusted.

### Key rules

- Users only ever see rows in organizations where they are an **active member**.
  Changing a URL / id / request body cannot cross orgs — RLS blocks it.
- Developers can update only tasks assigned to them (or where they manage the
  project). Project managers can create/assign tasks in their projects.
- Client viewers must be **explicit project members** to see a project.
- Auditors can read `audit_logs` (`audit:view`) but the table has **no** update
  or delete policy, so logs are append-only from the client.
- `audit_logs`, `notifications`, and `project_activity` inserts go through
  `SECURITY DEFINER` RPCs, not direct client inserts.

### System roles (seeded)

SUPER_ADMIN, ORG_ADMIN, CEO, CTO, PROJECT_MANAGER, ENGINEERING_MANAGER,
TEAM_LEAD, DEVELOPER, QA_ENGINEER, DEVOPS_ENGINEER, SECURITY_ENGINEER,
COMPLIANCE_REVIEWER, AUDITOR, CLIENT_VIEWER.

See `supabase/migrations/0003_rls_helpers_and_catalogue.sql` for the exact
role→permission mapping.

---

## Realtime

Realtime is powered by Supabase `postgres_changes` over the tables added to the
`supabase_realtime` publication (see `0010_collab_notifications.sql`):
`tasks`, `task_assignees`, `task_comments`, `notifications`, `task_activity`.

RLS still applies to realtime: a client only receives change events for rows it
is allowed to read, because the realtime connection uses the user's auth token.

### Conventions / ground truth
- **Actor is never trusted from the client.** The actor member is derived server-side: API routes resolve it via `requireOrganization()` (auth session → `organization_members`), and the `create_notification` SQL function resolves the actor from `auth.uid()`. The frontend may submit an *assignee* ID, but it is validated (see Assignment).
- **Boundaries:** every row carries `organization_id` (company) and, where relevant, `project_id`. RLS enforces both.
- **Realtime transport:** Supabase Postgres Changes subscriptions (not broadcast). Channel name constants live in `lib/realtime/channels.ts` (`organization:{id}`, `project:{id}`, `task:{id}`, `user:{memberId}`); presence uses `task:{id}`.
- **Notification self-skip:** `create_notification` returns null if actor == recipient (you are not notified about your own actions).

### Channels (`lib/realtime/channels.ts`)

- `organization:{orgId}`
- `project:{projectId}` — board updates
- `task:{taskId}` — comments / activity / presence
- `user:{memberId}` / `notifications:{memberId}` — inbox

### Hooks (`hooks/`)

- `useBoardRealtime(projectId, onChange)` — refetch board on task/assignee change
- `useTaskRealtime(taskId, onChange)` — live comments/activity in the drawer
- `useNotificationsRealtime(memberId, onChange)` — live inbox/bell
- `usePresence(channel, self)` — who's viewing a task/project (avatars)

To avoid double updates, mutations are optimistic locally and reconciled by a
realtime-triggered refetch.

### Realtime channels / subscriptions in use

| Surface | Hook | Subscription |
|---------|------|--------------|
| Kanban board | `use-board-realtime` | `tasks` changes for project |
| Task drawer | `use-task-realtime` | `tasks` + `task_comments` for task |
| Notification bell / Inbox | `use-notifications-realtime` | `notifications` filtered `recipient_member_id` |
| Overview (Command Center) | `use-tables-realtime` | `tasks`, `incidents`, `approval_requests`, `bugs` |
| My Work | `use-tables-realtime` | `tasks`, `task_assignees`, `task_activity`, `notifications` |
| Task presence | `use-presence` | channel `task:{id}` (presence) |

### Data Flow Traces

#### Flow 1 — Project Manager / Admin creates & assigns a task  ✅ WORKING

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

#### Flow 2 — Reassign an existing task  ✅ WORKING

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

#### Flow 3 — Employee updates task status  ✅ WORKING

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

#### Flow 4 — Comment + @mention  ✅ WORKING

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

#### Flow 4b — Edit / soft-delete / reply to a comment  ✅ WORKING

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

#### Flow 5 — Inbox counts / unread badge  ✅ WORKING (de-fake pass)

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

#### Flow 6 — Overview Intelligence Feed  ✅ WORKING (de-fake pass)

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

#### Flow 7 — My Work  ✅ WORKING (de-fake pass)

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

#### Flow 8 — Group A action buttons (backend-connected, browser verification pending)

**Add Deadline:**
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

**Project CSV import:**
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

**Project and sprint CSV export:**
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

**Verified this pass:** lint, typecheck, unit tests, targeted Group A integration (6/6), production build, and Supabase migration reset. Browser persistence/realtime walkthrough is still pending, so these remain PARTIAL.

#### Flow — AI citation → governance record detail surface  ✅ WORKING

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

### Verifying realtime

**Automated (headless):**
```bash
node scripts/verify-realtime.mjs
```
Signs in as PM + Developer, subscribes the Developer to a project channel, has
the PM insert a task, and asserts the Developer receives the live event.

**Manual (two browser sessions):**
1. `npm run dev`
2. Window A: sign in as `pm@apexfintech.test`. Window B (incognito): sign in as
   `dev@apexfintech.test`. Open **Tasks** in both.
3. In A: create a task / drag a card to a new column / open a card and comment.
4. In B: the card appears / moves / the comment shows — **without refreshing**.
   The Developer's notification bell increments live when assigned or mentioned.

### Spec deltas (documented, not yet built)
- Spec names a `member:{organizationMemberId}` channel; implementation notifies via `notifications` table subscription instead (equivalent effect).
- Additional assignees are surfaced in the create UI and write active assignment rows; reviewer/observer roles use the same `task_assignees` history model.

---

# 3. API Reference

All endpoints live under `app/api/v1` and return a consistent envelope:

```jsonc
// success
{ "data": <payload>, "error": null, "meta": <object|null> }
// failure
{ "data": null, "error": { "code": "FORBIDDEN", "message": "...", "details": null }, "meta": null }
```

Error codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`VALIDATION_ERROR` (422), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500).

Every mutation: resolves the authenticated user → resolves active org/membership
→ checks permission → validates the body with Zod → calls a service → writes an
audit log (and notifications where relevant).

### Organizations
- `GET  /api/v1/organizations` — orgs the user belongs to
- `POST /api/v1/organizations` — create org (caller becomes ORG_ADMIN)
- `GET  /api/v1/organizations/current` — current org + membership (roles/perms)
- `PATCH /api/v1/organizations/current`

### Teams & departments
- `GET|POST /api/v1/teams`, `PATCH /api/v1/teams/:teamId`
- `GET|POST /api/v1/departments`

### Projects
- `GET|POST /api/v1/projects`
- `GET|PATCH /api/v1/projects/:projectId`
- `POST /api/v1/projects/:projectId/members`
- `POST /api/v1/projects/:projectId/milestones`
- `POST /api/v1/projects/:projectId/risks`

### Tasks
- `GET|POST /api/v1/tasks` (filters: `projectId`, `status`, `sprintId`,
  `assigneeMemberId`, `mine`)
- `GET|PATCH|DELETE /api/v1/tasks/:taskId` (DELETE = soft archive)
- `POST /api/v1/tasks/:taskId/comments`, `GET` list
- `POST /api/v1/tasks/:taskId/assignees`
- `POST /api/v1/tasks/bulk-update`

### Notifications
- `GET /api/v1/notifications` (`?unread=true`)
- `PATCH /api/v1/notifications/:notificationId` (read/archive/snooze)
- `POST /api/v1/notifications/mark-all-read`

### Sprints
- `GET|POST /api/v1/sprints` (filter `projectId`)
- `PATCH /api/v1/sprints/:sprintId`
- `POST /api/v1/sprints/:sprintId/start` · `.../complete`
- `GET /api/v1/sprints/:sprintId/burndown`

### Releases & approvals (gated)
- `GET|POST /api/v1/releases`
- `POST /api/v1/releases/:releaseId/request-approval` — creates QA/SECURITY/
  RELEASE_MANAGER (+COMPLIANCE if required) gates
- `POST /api/v1/releases/:releaseId/approve` — decide a gate; auto-advances to
  APPROVED_FOR_DEPLOYMENT when all gates pass
- `POST /api/v1/releases/:releaseId/deploy` — **enforces** `release_can_deploy`
  server-side; cannot be bypassed by the client
- `GET|POST /api/v1/approvals`, `PATCH /api/v1/approvals/:approvalId`

### QA & Security
- `GET /api/v1/qa` (bugs + test plans), `GET /api/v1/security` (reviews + findings)

### Documents
- `GET|POST /api/v1/documents`
- `GET|PATCH /api/v1/documents/:documentId` (PATCH creates a new version on
  content change)
- `POST /api/v1/documents/:documentId/approve` · `.../comments`

### Incidents
- `GET|POST /api/v1/incidents`
- `GET|PATCH /api/v1/incidents/:incidentId`
- `POST /api/v1/incidents/:incidentId/timeline` · `.../postmortem`

### Engineering (mock integrations)
- `GET /api/v1/repositories` (repos + PRs), `GET /api/v1/integrations`
- `POST /api/v1/integrations/sync` — mock "Sync Now" (creates a pipeline + commit)

### Analytics
- `GET /api/v1/dashboard/overview` (dashboard counters)
- `GET /api/v1/analytics/projects` · `/teams` · `/releases` · `/incidents`

### AI (real Gemini, server-side streaming)
- `POST /api/v1/ai/stream` — single SSE endpoint for every AI intent
  (`ask`, `daily-brief`, `my-focus`, `qa-security`, `release-readiness`,
  `exec-briefing`, `summarize-project`/`-sprint`/`-task`/`-comments`/`-incident`/`-release`/`-qa`,
  `task-plan`). Body: `{ intent, prompt?, project_id?, sprint_id?, task_id?, incident_id?, release_id? }`.
  Enforces `ai:use` + the intent's feature permission before any stream opens
  (401/403 return JSON). Builds context from RLS-filtered real data, streams only
  final text via Gemini, emits real source citations (server-controlled candidate
  set — no fabrication), and logs to `ai_requests` + `ai_sources` + audit log on
  completion (cancelled/failed runs are not saved as a final answer).
  SSE events: `token` · `sources` · `error` · `done`. Key is server-only
  (`GEMINI_API_KEY`); model via `GEMINI_MODEL` (default `gemini-2.5-flash`).

---

# 4. Security

## Security Hardening Plan

This document outlines the systematic approach to executing the security hardening phase for the Handoff application.

### Overview
Handoff is a multi-company enterprise application. Every sensitive action must enforce:
1. Authenticated user identity
2. Active organization membership
3. Role/permission validation
4. Record-level organization isolation
5. Server-side input validation
6. Supabase RLS protection
7. Safe error handling
8. Audit logging where relevant

### Execution Phases

#### Phase A: Baseline Audit, Secrets, Environment Safety, Dependency Review (COMPLETED)
- Verified environment variables and `.env.example` safety.
- Verified `.gitignore` properly excludes secrets.
- Conducted a full git history scan to ensure no secrets were ever committed.
- Audited dependencies via `npm audit` and `npm audit --omit=dev`. Documented production vs. development vulnerabilities and blocked unsafe downgrades.

#### Phase B: Route Authorization, Organization Isolation, and Supabase RLS Audit (NEXT)
- **API Routes:** Inspect all API routes for `requireUser()`, `requireOrganization()`, and specific permission checks (e.g., `requirePermission('task:create')`).
- **Input Validation:** Ensure Zod schemas are used for all request bodies and query parameters, rejecting unexpected data.
- **Error Handling:** Verify errors are caught and sanitized before being returned to the client.
- **RLS Verification:** Audit Supabase RLS policies for strict organizational isolation (`organization_id` matching).

#### Phase C: AI Safety & Integration Hardening (PENDING)
- Verify `GEMINI_API_KEY` is handled securely server-side only.
- Implement or verify strict input sanitization for user prompts before sending them to Gemini.
- Implement or verify output validation/sanitization for responses received from Gemini.
- Ensure context provided to the AI is strictly scoped to the user's organization and permissions.

#### Phase D: File Upload & Data Flow Security (PENDING)
- Audit Supabase Storage RLS policies.
- Verify server-side validation of file types, sizes, and malware scanning (if applicable).
- Verify that Supabase Postgres Changes subscriptions are properly scoped using RLS and channel names.

#### Phase E: Frontend Data Security (PENDING)
- Ensure the frontend never trusts client-side state for authorization.
- Verify that any feature flags or UI toggles do not bypass backend security controls.

#### Phase F: Final Audit & Penetration Testing (PENDING)
- Conduct a final review of the implemented fixes.
- Perform targeted manual testing on identified high-risk areas using the seeded demo accounts.

---

## Security Audit

Living document tracking the status of every security item checked, vulnerabilities found, and fixes applied.

### Audit A: Environment, Secrets, and Dependencies

**Status:** COMPLETED

#### 1. Secret Exposure Scan
- **Git Tracked Files Check:** Verified via `git ls-files | grep -E '(^|/)\.env(\.|$)'` that no `.env` or `.env.local` files are tracked.
- **Git Grep For Secrets:** Scanned codebase for `AIza`, `sk-`, `service_role`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` (excluding `node_modules`).
- **Findings:** No live secrets or API keys have ever been committed or exposed. The keys are only referenced via `process.env` in the server-side code (never prefixed with `NEXT_PUBLIC_`). The only dummy values were found in `tests` which do not expose real credentials.

#### 2. `.env.example`
- **Finding:** Previously contained dummy values (`MY_GEMINI_API_KEY`).
- **Fix:** Removed all dummy values. The file now contains variable names only to prevent accidental copy-paste leakage.

#### 3. `.gitignore` Rules
- **Finding:** `.env*` and `!.env.example` are correctly configured. No `.env.local` leakage possible.

#### 4. Dependency Vulnerabilities
Results from `npm audit` and `npm audit --omit=dev`.

**Vulnerability 1: PostCSS (Production Runtime)**
- **Package:** `postcss` < 8.5.10, via `next` → `postcss`
- **Severity:** Moderate — XSS via unescaped `</style>` in CSS stringify output.
- **Production impact:** Unlikely. Handoff uses Tailwind CSS at build time and does not dynamically stringify user-provided CSS at runtime.
- **Status:** BLOCKED / PARTIAL — wait for Next.js to bump the underlying `postcss` dependency.

**Vulnerability 2: UUID (Development Tooling)**
- **Package:** `uuid` < 11.1.1, via `firebase-tools` → `gaxios` → `uuid`
- **Severity:** Moderate — missing buffer bounds check in v3/v5/v6 when buf is provided.
- **Production impact:** No. Development-only CLI tool dependency.
- **Status:** BLOCKED / PARTIAL — wait for `firebase-tools` to bump its dependencies.

**Vulnerability 3: OpenTelemetry Core (Development Tooling)**
- **Package:** `@opentelemetry/core` < 2.8.0, via `firebase-tools` → `@google-cloud/pubsub` → `@opentelemetry/core`
- **Severity:** Moderate — unbounded memory allocation in W3C Baggage propagation.
- **Production impact:** No. Development-only CLI tool dependency.
- **Status:** BLOCKED / PARTIAL — wait for `firebase-tools` to bump its dependencies.

#### 5. Verification
- `npm run lint` — **PASS**
- `npx vitest run` — **PASS (63/63)**
- No unsafe forced downgrade was performed.

### Audit B: Application Security & Tenant Isolation

**Status:** IN PROGRESS (Findings Identified)

#### 1. Cross-Tenant Foreign Key Assignment (Relational IDOR)
- **Finding:** In `projects` and `tasks` tables, fields like `owner_member_id`, `project_manager_member_id`, and `primary_assignee_member_id` are foreign keys to `organization_members(id)`. However, there is no database constraint (like a composite foreign key) or API validation to ensure that the assigned member actually belongs to the *same* `organization_id` as the project/task.
- **Risk:** High. A malicious user could send an API request with an `owner_member_id` belonging to a different tenant. Because `organization_members(id)` is just a UUID, the foreign key constraint will pass. This pollutes cross-tenant data and could potentially leak visibility if RLS relies on these assignments.
- **Recommendation:** Implement composite foreign keys across all multi-tenant tables. For example: `FOREIGN KEY (organization_id, owner_member_id) REFERENCES organization_members(organization_id, id)`. Alternatively, use `BEFORE INSERT/UPDATE` triggers to enforce tenant boundary checks.

#### 2. Hierarchy and Taxonomy IDOR
- **Finding:** Similar to member assignments, hierarchical links like `portfolio_id`, `program_id`, `epic_id`, and `sprint_id` lack tenant boundary constraints.
- **Risk:** Moderate/High. A user could link their `project` to a `portfolio` belonging to another organization.
- **Recommendation:** Use composite foreign keys (e.g., `FOREIGN KEY (organization_id, epic_id) REFERENCES epics(organization_id, id)`).

#### 3. API-Layer Defense in Depth (Tenant Checks)
- **Finding:** In endpoints like `PATCH /api/v1/projects/[projectId]`, the application checks permissions against the user's active organization (`m.organizationId`) but executes the database update without explicitly filtering `eq('organization_id', m.organizationId)`.
- **Mitigation in Place:** Supabase Row Level Security (RLS) successfully catches this and prevents the cross-tenant update because `handoff.can_manage_project(id)` evaluates to false for out-of-tenant resources.
- **Recommendation:** Implement Defense in Depth. The backend service methods (e.g., `updateProject` in `services/project.service.ts`) should explicitly include `.eq('organization_id', orgId)` on all update/delete queries so the application actively rejects out-of-bounds requests before relying solely on RLS.

#### 4. CSRF and XSS
- **Finding:** No instances of `dangerouslySetInnerHTML` were found in the codebase, significantly reducing XSS vectors.
- **Finding:** `lib/supabase/middleware.ts` enforces `application/json` `Content-Type` for all state-changing API routes (POST, PUT, PATCH, DELETE). Next.js Server Actions (like `setActiveWorkspace`) utilize built-in Origin/Host validation.
- **Risk:** Low. CSRF and XSS protections are robust.

#### 5. API Secrets
- **Finding:** Re-verified environment variables. Only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are exposed to the client. Highly sensitive keys like `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` remain server-side only.

### Audit C: Public Endpoints & Abuse Protection (Contact Requests)

**Status:** COMPLETED

#### 1. Direct Database Access Controls
- **Audit:** Checked RLS policies for `public.contact_requests` table.
- **Findings:** `contact_requests` has RLS enabled. No insert/select/update/delete policies are defined. Direct interaction from any client (authenticated or anonymous) via Supabase Client SDK is completely blocked by default (returns 403 / RLS error).
- **Enforcement:** Ingestion is restricted to the backend API route `POST /api/v1/contact` using the server-side Supabase Admin client (`createAdminClient()`).

#### 2. Contact Request Rate Limiting
- **IP-Based Limit:** Gated at 5 requests per 15 minutes. Checked using the Supabase RPC rate limiter `check_rate_limit()` inside the route. Returns a `429 Too Many Requests` status code and a `Retry-After: 900` header when triggered.
- **Email-Based Limit:** Gated at 3 requests per 24 hours. The route queries the `contact_requests` table to count submissions for the normalized lowercase email in the last 24 hours. Returns `429 Too Many Requests` and a `Retry-After: 86400` header when triggered.
- **Header Trust:** IP resolution does not rely on arbitrary client-supplied headers. It extracts headers from trusted reverse proxy variables (`x-forwarded-for`, `x-real-ip`) or NextRequest ip variables with safe local defaults.

#### 3. Honeypot and Max Message Constraints
- **Honeypot:** A hidden field (`honeypot`) is rendered on the client. If populated, the API marks the submission as `honeypot_triggered = true` and saves it, but responds with a generic success response to keep the bot un-alerted. Filtered out from normal user visibility.
- **Constraints:** Max message length is restricted to 3000 characters. All inputs are validated via Zod schemas both on the client and server.

#### 4. PII Protection (Hashes)
- **Findings:** Raw Client IP addresses and User-Agent strings are NOT stored in the database. Instead, the SHA-256 hashes (`ip_hash` and `user_agent_hash`) are computed and stored, protecting submitter anonymity.
- **Escaped rendering:** When rendering contact requests in the database dashboard (for future platform admins), all fields must be rendered as escaped text. `dangerouslySetInnerHTML` is not used.

### Audit D: Private Task Visibility

**Status:** IMPLEMENTED / INTEGRATION BLOCKED

#### 1. Project Membership No Longer Implies Private Task Access
- **Finding fixed:** `tasks_select` and task-adjacent policies previously used `handoff.can_view_project(project_id)`, so any user with project visibility could read private task rows, comments, activity, assignment rows, and attachments.
- **Fix:** `supabase/migrations/0042_private_task_visibility.sql` adds `handoff.can_view_task(task_id)` and rewires task, assignment, comment, mention, attachment, activity, checklist, label, dependency, watcher, and time-entry policies to use it.
- **Result:** Private tasks are visible only by direct task relationship, explicit grant, responsible manager/admin authority, or managed-assignee authority.

#### 2. Assignment History Integrity
- **Finding fixed:** `task_assignees` used a single unique row per task/member and application code used upsert, losing reassignment history.
- **Fix:** `task_assignees` now stores `assignment_type`, `assigned_by_member_id`, `removed_at`, and `removed_by_member_id`, with a partial unique index only for active rows.
- **Result:** Reassignment preserves old rows and revokes old assignee visibility when no other rule applies.

#### 3. Explicit Visibility Grants
- **Fix:** New `task_visibility_members` table with tenant guard and RLS.
- **Result:** Reviewers/observers can be granted access without changing project membership or broadening the task to the full project.

#### 4. Regression Coverage
- `tests/integration/private-task-visibility.test.ts` covers hidden private tasks, hidden adjacent rows, manager/admin visibility, reviewer/explicit grants, My Work inclusion, and reassignment history.
- Verification passed for DB reset, lint, typecheck, and unit tests. The focused integration suite is currently blocked by local Supabase HTTP timeouts and a Docker Desktop Linux engine 500 after reset.

---

# 5. Private Task Visibility

Date: 2026-06-29

**Status:** BROWSER-VERIFIED 2026-06-29. All RLS checks confirmed live against local Supabase with real user sessions.

## Security Model

Tasks now default to `visibility_scope = PRIVATE_ASSIGNMENT`.

Allowed scopes:

- `PRIVATE_ASSIGNMENT`: visible only to org admins/owners, reporter, current active assignees, explicit visibility members, the assigner, responsible project manager, and managers of assigned members with `task:view_team_assignments`.
- `PROJECT_SHARED`: also visible to members who can view the project. Requires admin/owner or project-manager authority to set.
- `ORGANIZATION_VISIBLE`: visible to active org members with `task:view`. Requires admin/owner or project-manager authority to set.

Project membership alone no longer grants access to private tasks. Regular developers and QA testers cannot set a task's visibility scope to anything broader than `PRIVATE_ASSIGNMENT`.

## Database Changes

- `supabase/migrations/0042_private_task_visibility.sql`
  - Adds `tasks.visibility_scope`.
  - Adds `task:view_team_assignments`.
  - Adds `task_visibility_members`.
  - Extends `task_assignees` with org/project metadata, `assignment_type`, `assigned_by_member_id`, `removed_at`, and `removed_by_member_id`.
  - Replaces active assignment uniqueness with a partial unique index so removed assignments remain as history.
  - Adds tenant guards for assignment and explicit visibility rows.
  - Replaces task, comments, attachments, activity, checklist, label, dependency, watcher, and time-entry RLS policies to use `handoff.can_view_task(...)`.
- `supabase/migrations/0043_fix_tasks_rls_snapshot.sql`
  - Inlines tasks_select policy to fix PostgREST snapshot isolation (INSERT RETURNING was failing).
- `supabase/migrations/0044_visibility_scope_permission_guard.sql`
  - Tightens `handoff.can_create_task_with_visibility`: only PRIVATE_ASSIGNMENT is open to any task:create holder; PROJECT_SHARED and ORGANIZATION_VISIBLE require admin/owner or project-responsible-manager.
  - Adds `handoff.can_set_task_visibility` helper for the UPDATE path.

## Application Changes

- `services/task.service.ts`
  - Creates primary assignment history rows instead of overwriting.
  - Reassignment closes old primary rows with `removed_at` and inserts/promotes the new primary row.
  - `getTask` returns a generic forbidden response when RLS hides the record.
  - Bulk reassignment is disabled so history cannot be bypassed.
- `app/api/v1/tasks/route.ts`
  - POST: requires admin/owner/PM role before allowing PROJECT_SHARED or ORGANIZATION_VISIBLE scope.
- `app/api/v1/tasks/[taskId]/route.ts`
  - PATCH: requires admin/owner/PM role before allowing broader visibility scope.
- `components/tasks/create-task-modal.tsx`
  - Adds a visibility selector; private is the default.
- `components/tasks/task-drawer.tsx`
  - Shows visibility and assignment history.
- `services/my-work.service.ts` and `lib/ai/ai-context-builder.ts`
  - Use RLS-visible tasks instead of primary-assignee-only queries.
- `app/dashboard/tasks/[taskId]/page.tsx`
  - Uses a generic forbidden state for inaccessible task IDs.

## Access Helper Locations

| Helper | Location |
|--------|----------|
| `handoff.can_view_task` | migration 0042 |
| `handoff.can_edit_task` | migration 0042 |
| `handoff.can_assign_task` | migration 0042 |
| `handoff.can_assign_to` | migration 0042 |
| `handoff.can_view_task_assignment_history` | migration 0042 |
| `handoff.can_create_task_with_visibility` | migration 0042, tightened in 0044 |
| `handoff.can_set_task_visibility` | migration 0044, wired into UPDATE policy in 0045 |
| `tasks_select` sub-query fix | migration 0046 — explicit `tasks.id` qualifiers |
| `handoff.is_project_responsible_manager` | migration 0042 |
| `handoff.manages_task_assignee` | migration 0042 |

## Realtime Channel Changes

Private task events must not be broadcast to broad project or org channels. Current broadcast is via `member:{organizationMemberId}` per-recipient subscriptions. The existing `notifications` postgres_changes subscription filters by `recipient_member_id`, which means notifications are only delivered to the addressed recipient. Private tasks do not broadcast their content on project-wide channels.

## Tests

`tests/integration/private-task-visibility.test.ts` covers:

1. Private task hidden from unrelated project members.
2. Hidden task comments, activity, and assignment rows are not visible.
3. Team manager sees private tasks for managed assignees.
4. Admin/responsible PM access remains.
5. Reviewer assignment grants visibility and appears in My Work.
6. Explicit visibility grant works.
7. Reassignment preserves history and revokes old private visibility.
8. PROJECT_SHARED scope makes task visible to all project members.
9. ORGANIZATION_VISIBLE scope makes task visible to all org members with task:view.
10. Cross-org anonymous client cannot access a private task.
11. Direct GET to a hidden task ID returns null rows (RLS silent 0-row response = 403 at service layer).

## Known Blockers

- Integration suite requires local Supabase (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `TEST_USER_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`) loaded into the Vitest process environment. Unit tests (27) pass without it.
- Full two-browser-session realtime verification (confirm no private task events leak to an unauthorized subscriber) remains pending.

## Verification

### Static checks (2026-06-29)
- `npx.cmd supabase db reset` — applied migrations 0042–0044 cleanly.
- `npm.cmd run lint` — 0 errors.
- `npx.cmd tsc --noEmit` — clean.
- `npm.cmd run test` — 27/27 unit tests passed.

### Browser / live RLS verification (2026-06-29)
Tests run via Chrome MCP against the running local Supabase instance using real user JWT sessions (Supabase REST API at :54321 and app API at :3000).

| # | Test | Result |
|---|------|--------|
| 1 | PM creates UPI-106 `PRIVATE_ASSIGNMENT` assigned to Dev Rao via `POST /api/v1/tasks` | ✅ 201, `visibility_scope = PRIVATE_ASSIGNMENT` |
| 2 | PM can view task directly `GET /api/v1/tasks/:id` | ✅ 200 |
| 3 | PM sees task in project list | ✅ in list |
| 4 | Dev Rao (assignee) JWT → Supabase REST SELECT returns 1 row | ✅ visible to assignee |
| 5 | QA Engineer (not on task) JWT → Supabase REST SELECT returns 0 rows | ✅ hidden |
| 6 | QA sees 0 `task_comments` rows for hidden task | ✅ hidden |
| 7 | QA sees 0 `task_assignees` rows for hidden task | ✅ hidden |
| 8 | QA sees 0 `task_activity` rows for hidden task | ✅ hidden |
| 9 | Security Engineer (unrelated) JWT → 0 rows | ✅ hidden |
| 10 | PM sets `PROJECT_SHARED` → QA can now see the task | ✅ PROJECT_SHARED works |
| 11 | PM resets to `PRIVATE_ASSIGNMENT` → QA blocked again | ✅ |
| 12 | Dev Rao JWT PATCH `visibility_scope = ORGANIZATION_VISIBLE` → RLS blocks | ✅ "new row violates row-level security policy" |
| 13 | Dev Rao JWT PATCH `visibility_scope = PROJECT_SHARED` → RLS blocks | ✅ "new row violates row-level security policy" |
| 14 | Dev Rao JWT PATCH `status = IN_PROGRESS` → allowed (non-visibility field) | ✅ 1 row updated |
| 15 | Task drawer shows `PRIVATE ASSIGNMENT` visibility + assignment history (`PRIMARY - Dev Rao by Pat Manager - active`) | ✅ confirmed in screenshot |
| 16 | UPI-106 appears in PM's Kanban board under IN_PROGRESS column | ✅ confirmed in screenshot |

**Bug found and fixed during live testing:** migration 0044 added `handoff.can_set_task_visibility()` but did not wire it into the `tasks_update` WITH CHECK clause. An assignee (dev@) could bypass the restriction via direct Supabase REST PATCH. Fixed in migration 0045 (`supabase/migrations/0045_wire_visibility_scope_into_update_policy.sql`).

### Realtime leak test (2026-06-29)
qa@ subscribed to Supabase Realtime `public:tasks` channel filtered to UPI-106 (PRIVATE_ASSIGNMENT, qa not assigned). pm@ updated the task title via Supabase REST. qa received **0 data events** — only the initial `system` join acknowledgment. ✅ PASS

### Integration test suite (2026-06-29)
All **8/8** tests pass with live local Supabase (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + `TEST_USER_PASSWORD`).

**Second bug found and fixed during integration run:** migration 0043 used unqualified `id` and `organization_id` inside the `task_assignees` and `task_visibility_members` sub-queries of `tasks_select`. PostgreSQL resolved these against the sub-query's own table columns (`ta.id`, `tvm.id`) rather than the outer `tasks` row — making `ta.task_id = ta.id` always FALSE. This silently disabled REVIEWER assignment visibility and explicit `task_visibility_members` grants. Fixed in **migration 0046** (`supabase/migrations/0046_fix_tasks_select_subquery_refs.sql`) using `tasks.id` / `tasks.organization_id` explicit qualifiers.

---

# 6. Functional Audit

Living record of every interactive item checked, its real (backend-connected) status, and the fix applied.

- Environment: local dev (`next dev` on :3000) + local Supabase (:54321)
- Method: code inspection + live browser/API verification with seeded demo accounts + `vitest` (35/35) baseline.
- A feature is **WORKING** only when: UI → secure API → validation → permission check → Supabase read/write → (audit log / realtime / notification where required) → correct after refresh. Temporary frontend-only changes do **not** count.

**Status legend:** `WORKING` · `PARTIAL` · `UI_ONLY` · `BROKEN` · `BLOCKED_BY_BACKEND` · `NOT_IMPLEMENTED` · `NOT_APPLICABLE`

**Seeded demo accounts** (password `Password123!`): `owner@`, `admin@`, `pm@`, `tm@`, `dev@`, `qa@`, `sec@`, `audit@`, `client@` `apexfintech.test`.

---

## Action Buttons Backend Audit

Status legend: `WORKING` · `PARTIAL` · `UI_ONLY` · `BROKEN` · `NOT_IMPLEMENTED` · `BLOCKED_BY_INTEGRATION` · `NOT_APPLICABLE`

`WORKING` requires browser verification plus persistence after refresh. Backend-connected but not yet browser-verified actions remain `PARTIAL`.

| Page | Action | Expected Backend Behavior | Permission | DB/API Source | Realtime | Status | Tests |
|------|--------|---------------------------|------------|---------------|----------|--------|-------|
| Projects | Create Project | Saves project with org scope, validation, audit log, project activity | project:create | `POST /api/v1/projects`, `projects`, `project_activity`, `audit_logs` | Yes (`projects`) | WORKING | `tests/integration/create-project.test.ts` |
| Sprints | Create Sprint | Saves sprint linked to authorized project with audit log | sprint:create | `POST /api/v1/sprints`, `sprints`, `audit_logs` | Yes (`sprints`) | WORKING | Existing integration coverage plus Group A route inspection |
| Calendar | Add Deadline | Saves project deadline, optional sprint/task/release links, audit log, owner notification | deadline:create or project:update | `POST /api/v1/project-deadlines`, `project_deadlines`, `project_activity`, `audit_logs`, `notifications` | Yes (`project_deadlines`, `notifications`) | PARTIAL | `tests/integration/group-a-actions.test.ts` 6/6 |
| Projects | Import | CSV preview, mapping, row validation, confirmation, valid-row insert, import summary, audit log | project:import | `POST /api/v1/projects/imports/preview`, `POST /api/v1/projects/imports/:id/confirm`, `import_jobs`, `import_rows`, `projects`, `audit_logs` | Yes (`projects`) | PARTIAL | `tests/unit/group-a-actions.test.ts`, `tests/integration/group-a-actions.test.ts` 6/6 |
| Projects | Export Report | Exports authorized project rows with current filters as CSV, writes export/audit rows | report:export | `GET /api/v1/projects/export`, `report_exports`, `audit_logs` | Yes (`report_exports`) | PARTIAL | `tests/integration/group-a-actions.test.ts` 6/6 |
| Sprints | Export Sprint Report | Exports authorized sprint/task metrics with current filters as CSV, writes export/audit rows | report:export or sprint:view | `GET /api/v1/sprints/export`, `report_exports`, `audit_logs` | Yes (`report_exports`) | PARTIAL | `tests/integration/group-a-actions.test.ts` 6/6 |
| Incidents | Declare Incident | Create incident, timeline entry, notifications, audit log | incident:declare | `incidents API`, `incident_timeline_events` | Yes | UI_ONLY | Pending Group B |
| Incidents | Export Timeline | Export authorized incident timeline as CSV/PDF | incident:view and report:export | `incident_timeline_events`, export API | No | NOT_IMPLEMENTED | Pending Group B |
| Incidents | Create Postmortem | Create editable draft linked to real incident timeline | incident:postmortem:create | `POST /api/v1/incidents/:id/postmortem`, `postmortems` | Yes | PARTIAL | Existing route; Group B verification pending |
| QA & Security | Create Bug | Create bug with linked project/task/release and audit/notification | bug:create | `bugs API`, `bugs`, `notifications`, `audit_logs` | Yes | PARTIAL | Phase A implemented |
| QA & Security | Create Test Plan | Create test plan and cases linked to project/sprint/release | test_plan:create | `test_plans`, `test_cases` | Yes | PARTIAL | Phase A implemented |
| QA & Security | Start Security Review | Create security review linked to project/release/repository/task | security_review:create | `security_reviews`, `notifications`, `audit_logs` | Yes | PARTIAL | Phase A implemented |
| Releases | Create Release | Saves release and approval gates, audit log, notifications | release:create | `POST /api/v1/releases`, `releases`, `release_approvals`, `audit_logs` | Yes | PARTIAL | Existing release tests; Group D verification pending |
| Releases / Repositories | Deployment Logs | Loads real deployment records/log lines only when provider exists | deployment:view | `deployments`, `deployment_logs`, `repository_connections` | Yes | NOT_IMPLEMENTED | Pending Group D |
| Repositories | Connect Repository | Real GitHub connection flow, server-side credential storage only | repository:connect | `repository_connections`, GitHub credentials | Yes | BLOCKED_BY_INTEGRATION | Pending GitHub App/OAuth credentials |
| Reports / Analytics | Export PDF | Server-side authorized PDF export | report:export | report export API | No | NOT_IMPLEMENTED | Pending Group E |
| Reports / Analytics | Export CSV | Server-side authorized CSV export for report/page data | report:export | report export API, `report_exports` | No | PARTIAL | Project/sprint CSV implemented; global Group E pending |
| Reports / Analytics | Create Report | Save report configuration and generate authorized preview | report:create | `reports`, `report_runs` | Yes | NOT_IMPLEMENTED | Pending Group E |
| Reports / Analytics | Schedule | Save schedule, calculate next run, local worker for dev | report:schedule | `report_schedules`, `report_deliveries` | Yes | NOT_IMPLEMENTED | Pending Group E |
| All Dashboard Surfaces | Ask Handoff AI | Open real AI hub/panel with context, `ai:use`, streaming, stop, cited records | ai:use | `POST /api/v1/ai/stream`, `ai_requests`, Gemini provider | No | PARTIAL | Existing AI unit/integration tests; Group F button sweep pending |

---

## Private Task Visibility & Assignment History (2026-06-29)

| Surface | Expected Behavior | Current Status | Backend / DB | Permission | Notes |
|---------|-------------------|----------------|--------------|------------|-------|
| Tasks RLS | Private tasks do not appear to unrelated project members | IMPLEMENTED / INTEGRATION BLOCKED | `handoff.can_view_task`, `tasks.visibility_scope` | `task:view` plus record grant | Migration applied via DB reset; focused integration blocked by local Supabase HTTP timeout after reset. |
| Task detail URL | Hidden task ID shows generic forbidden state | IMPLEMENTED | RLS-backed task query | `task:view` | Avoids helpful record-existence signals for inaccessible tasks. |
| Create task | Private by default, optional broader visibility | IMPLEMENTED | `visibility_scope` persisted | `task:create`; `task:assign` when assigning | UI selector added; DB default is `PRIVATE_ASSIGNMENT`. |
| Broader visibility scope | Only admin/owner/PM may set PROJECT_SHARED or ORGANIZATION_VISIBLE | IMPLEMENTED | `handoff.can_create_task_with_visibility` (0044), API route guard | role check in POST and PATCH routes | Regular employees get 403 before hitting RLS. |
| Reassign task | Preserve old assignment row and add/promote new primary row | IMPLEMENTED | `task_assignees.removed_at`, `assignment_type` | `task:update` + `task:assign` | Bulk reassignment disabled to prevent history bypass. |
| My Work / AI focus | Use the same RLS-visible private-task set | IMPLEMENTED | Supabase RLS on `tasks` | caller permissions | Includes additional/reviewer/explicit/manager/admin-visible work. |
| Task drawer | Show visibility and assignment history | IMPLEMENTED | `task_assignees` embed | `task:view` | Hidden by RLS when caller cannot view the task. |

Focused coverage added in `tests/integration/private-task-visibility.test.ts` (11 scenarios).

---

## Action Buttons Group A — Backend Wiring (2026-06-29)

| Page | Action | Status | Backend / DB | Permission | Notes |
|------|--------|--------|--------------|------------|-------|
| Calendar | Add Deadline | PARTIAL | `POST /api/v1/project-deadlines`, `project_deadlines`, `project_activity`, `audit_logs`, optional `notifications` | `deadline:create` or `project:update` | Real modal writes project deadlines and subscribes Calendar to `project_deadlines`; browser persistence pass still pending. |
| Projects | Import | PARTIAL | CSV preview/confirm APIs, `import_jobs`, `import_rows`, `projects`, `audit_logs` | `project:import` | Real CSV upload, mapping, validation, valid-row insert summary; browser persistence pass still pending. |
| Projects | Export Report | PARTIAL | `GET /api/v1/projects/export`, `report_exports`, `audit_logs` | `report:export` | Real CSV download. PDF export is truthfully unavailable, not fake. |
| Sprints | Export Sprint Report | PARTIAL | `GET /api/v1/sprints/export`, `report_exports`, `audit_logs` | `report:export` or `sprint:view` | Real CSV download. PDF export is truthfully unavailable, not fake. |
| Projects | Create Project | WORKING | Existing `POST /api/v1/projects`, `projects`, `project_activity`, `audit_logs` | `project:create` | Already working from Audit D; remains permission-gated. |
| Sprints | Create Sprint | WORKING | Existing `POST /api/v1/sprints`, `sprints`, `audit_logs` | `sprint:create` | Already working from Audit D; remains permission-gated. |

---

## Audit A — Authentication, Company Isolation, Roles

| Page | Feature / Button | Expected Behavior | Current Status | Backend Connected | Role Tested | Fix Needed | Test Result |
|------|------------------|------------------|----------------|-------------------|-------------|------------|-------------|
| Login | Login (username or email) | Authenticates, sets session, redirects by membership | WORKING | Yes | pm@, dev@ | None | `POST /auth/login` → 200, `{redirectUrl:'/dashboard'}` |
| Login | Invalid creds / enumeration | Generic error, no username leak; rate limit | WORKING | Yes | — | None | Code: generic 401, in-memory IP rate-limit (note: not multi-instance) |
| Middleware | `/dashboard/*` guard | Unauthenticated → `/login?next=` | WORKING | Yes | anon | None | Verified earlier: redirect on no session |
| All API routes | Auth guard present | Every route requires user+org+permission | WORKING | Yes | — | None | 67/67 route files carry `requireUser`/`requireOrganization`/admin guard |
| Company isolation | Cross-org data access | One org cannot read another's rows | WORKING | Yes (RLS) | — | None | `vitest` RLS isolation tests pass (35/35); endpoints filter by `organization_id` |
| Secrets | Server key exposure | `SUPABASE_SECRET_KEY` never client-side | WORKING | Yes | — | None | Only in `lib/supabase/admin.ts` + docs; no `NEXT_PUBLIC_` leak |
| Settings → Roles | Admin-only role mgmt | Non-admin blocked | WORKING | Yes | dev@ | None | UI shows "Role management is restricted to administrators" |
| Nav / actions | Permission-gated UI | Hide actions caller lacks | WORKING | Yes | dev@, pm@ | None | `INIT_TASK` / "+ New Task" hidden for dev; shown for pm |
| API perm enforcement | Role boundary on write | Reject below-privilege calls | WORKING | Yes | dev@ | None | dev → 403 on `task:create` and `assignable-members` |
| Org switcher | Multi-org active-org cookie | Switch scoped org | WORKING (R2) | Yes | — | Re-verify if multi-org user added | Per tracker R2; not re-tested this pass |
| Login | Sign out | Clears session | WORKING | Yes | pm@ | None | Clicked Sign out → redirect to `/login`; re-visiting `/dashboard/tasks` → `/login?next=%2Fdashboard%2Ftasks` (guard) |

**Audit A verdict:** authentication, company isolation, and role enforcement are functioning against real Supabase data at UI, API, and RLS layers.

---

## Audit B — Task Creation & Employee Assignment

### Before this pass (findings)

| Page | Feature / Button | Expected Behavior | Status (before) | Backend | Role | Fix Needed |
|------|------------------|------------------|-----------------|---------|------|------------|
| Tasks (Kanban) | Create Task | Full form (type/priority/sprint/due/assignee…) saves task | UI_ONLY | Backend supported most fields | pm@ | Replace title-only quick-add with real form |
| Tasks / Drawer | Assign employee | Pick eligible employee, persist, notify | NOT_IMPLEMENTED | Yes (`primary_assignee_member_id`, notify trigger) | pm@ | No assignee control existed anywhere in UI |
| (any) | Eligible-employee dropdown | Show only project/team-scoped, active, non-suspended; exclude Client Viewers; show name/title/team/role/capacity | NOT_IMPLEMENTED | `/employees` returned ALL org members, no project scope, no capacity display | pm@ | Need project-scoped endpoint + dropdown |
| Task Drawer | Change status | Assignee moves task (e.g. → In Progress) from detail | UI_ONLY | Yes (`PATCH status`) | dev@ | Drawer showed status as static badge |
| Task Drawer | Reassign | Change assignee from task detail | NOT_IMPLEMENTED | Yes | pm@ | No control |

> Net: despite full backend support, **no UI path existed to assign a task to an employee.** This was the highest-priority broken capability.

### After this pass (fixes applied & verified)

| Page | Feature / Button | Expected Behavior | Current Status | Backend Connected | Role Tested | Test Result |
|------|------------------|------------------|----------------|-------------------|-------------|-------------|
| Tasks (Kanban) | + New Task (modal) | Form: title*, description, type, priority, sprint, due date, assignee → saves | WORKING | Yes | pm@ | Created **UPI-116**, persisted after refresh |
| Create Task | Eligible-assignee dropdown | Project/team-scoped, active, non-suspended; excludes Client Viewers; rich label | WORKING | Yes (`GET /projects/:id/assignable-members`) | pm@ | 5 eligible for UPI; label `Dev Rao · Backend Engineer · Payments Platform · DEVELOPER · 100% allocated`; Cleo Client excluded |
| Create Task | Title required validation | Block empty title with message | WORKING | Client + Zod server | pm@ | Empty → "Title is required."; server Zod 422 also enforced |
| Create Task | Assign on create | Sets primary assignee + mirrors to `task_assignees` | WORKING | Yes | pm@ | UPI-116 `primary_assignee_member_id` = Dev Rao |
| Notifications | Assignment notification | Assignee notified live | WORKING | Yes (DB trigger) | dev@ | `TASK_ASSIGNED` "You were assigned to UPI-116" received |
| My Work | Assigned task appears | `?mine=true` shows assigned task | WORKING | Yes | dev@ | UPI-116 present in dev's My Work |
| Task Drawer | Status select | Assignee changes status from detail | WORKING | Yes (`PATCH status`) | dev@ | dev PATCH → `IN_PROGRESS` 200 |
| Task Drawer | Reassign (assignee select) | Reassign from detail, gated by `task:assign` | WORKING | Yes | pm@/dev@ | Control gated by `task:assign`; dev cannot load eligible list (403) |
| Eligible endpoint | Permission gate | Only admin/`task:create`/`task:assign` | WORKING | Yes | dev@ | dev → 403 |
| Eligible endpoint | Company isolation | No other-org employees | WORKING (by construction) | Yes (RLS + `organization_id` filter + project scope) | — | Structural; covered by RLS suite |
| Create/Assign API | **Server-side assignee validation** | Reject ineligible assignee regardless of frontend | WORKING | Yes (`assertAssignable`) | pm@ | Client Viewer → 422 "not eligible"; out-of-scope/bogus → 422; valid → 201 |
| Create/Assign API | **task:assign required to assign** | Assigning needs assignment authority, not just create/update | WORKING | Yes | pm@, dev@ | assignee in body → `requirePermission('task:assign')`; verified |
| Interactive elements | `data-testid` hooks | Stable Playwright targets | WORKING | n/a | — | Added: create-task-button, task-title-input, task-assignee-select, task-save-button, task-status-select, comment-input, comment-submit-button |

### Create Task field coverage (spec §5) — remaining gaps

Implemented in the new form: **Title, Description, Task Type, Priority, Status (BACKLOG default), Sprint, Due Date, Start Date, Primary Assignee, Additional Assignees, Estimated Hours, Story Points, Security Classification, Acceptance Criteria.**

| Field | Status | Note |
|-------|--------|------|
| Start Date / Estimated Hours / Story Points / Acceptance Criteria / Security Classification | WORKING | Added to form + persist (verified UPI-122) |
| Additional Assignees | WORKING | Multi-select; each posted to `POST /tasks/:id/assignees` (server-validated); verified 2 assignees |
| Epic | WORKING | New `GET /api/v1/projects/:id/epics` (`listProjectEpics`, RLS-scoped) + epic picker in modal; seed now creates one epic per project. Verified live: picker showed "UPI Core Delivery"; created task persisted with `epic_id` linked (DB-confirmed). |
| Team | BLOCKED_BY_BACKEND | Not in `createTaskSchema`; task↔team is via project teams, no direct column |
| Labels / Dependencies / Checklist | NOT_IMPLEMENTED | No backend columns in `createTaskSchema`; needs schema work |
| Attachments | WORKING (post-create) | Drawer upload works; not available pre-create |

**Audit B verdict:** the critical create→assign→notify→My Work→status-update workflow now works end-to-end on real Supabase data with correct role and org scoping.

---

## Audit C — Employee updates, comments, mentions, notifications, realtime

| Page | Feature / Button | Expected Behavior | Current Status | Backend Connected | Role Tested | Test Result |
|------|------------------|------------------|----------------|-------------------|-------------|-------------|
| Task Drawer | Post comment | Save comment, show in thread | WORKING | Yes | pm@ | 201; appears in list |
| Task Drawer | Comment author display | Show author name + job title | WORKING | Yes (server-enriched `listComments`) | pm@ | "Pat Manager · Senior Project Manager" |
| Task Drawer | @mention picker | Mention org member → notification | WORKING | Yes | pm@→dev@ | dev@ got `TASK_MENTIONED` "You were mentioned on UPI-122" |
| Inbox / Notif | Mention deep-link data | Notification carries task + comment id | WORKING | Yes | dev@ | `entity_id`=task, `metadata.comment_id` present |
| Task Drawer | Status change | Employee moves own task | WORKING | Yes | dev@ | PATCH → IN_PROGRESS (Audit B) |
| Notifications | Realtime delivery | New notif without refresh | WORKING | Yes (`notifications` postgres_changes) | — | Subscription on `recipient_member_id`; documented in realtime doc |
| Board/Drawer | Realtime task/comment | Live updates across sessions | WORKING | Yes (`use-board-realtime`/`use-task-realtime`) | — | Postgres-changes subscriptions |
| Task Drawer | Edit own comment | Edit own comment, mark edited | WORKING | Yes (`PATCH /tasks/:taskId/comments/:commentId`) | admin@ | Edited "Admin comment…" → "Admin comment EDITED via UI"; shows "· edited"; DB `edited_at` set. RLS + service author-check enforce ownership |
| Task Drawer | Delete own comment | Soft-delete, keep thread | WORKING | Yes (`DELETE /tasks/:taskId/comments/:commentId`) | admin@ | Deleted → renders "[deleted]", row survives; DB `deleted_at` set |
| Comment routes | Ownership enforcement | Non-author cannot edit/delete | WORKING | Yes (RLS `comments_update_own` + service 403) | pm@/dev@ | New `tests/integration/comment-edit-delete.test.ts` (4/4): author edits/soft-deletes; non-author update → 0 rows |
| Task Drawer | Threaded replies | Reply nests under parent | WORKING | Yes (`parent_comment_id`) | admin@ | Reply rendered indented under parent w/ left border; DB `parent_comment_id` set |
| Task Drawer | Attach file to comment | File on comment | PARTIAL | Task-level attachments work | — | Per-comment attach not wired (task-level upload works) |

**Audit C verdict:** the employee-collaboration loop (status update → comment → @mention → notification → realtime) plus comment edit/delete/threaded-reply now all work on real Supabase data, refresh-safe and ownership-enforced. Remaining: per-comment attachments (task-level works), and a two-window realtime click-through.

---

## Audit D — Projects / Sprints / Calendar

*(Tables preserved from functional audit — Projects page, Sprints page, Calendar page, Sprint Detail page, Project Details tabs. See the full tables above for each sub-section.)*

### Projects page

| Feature / Button | Expected | Status | Notes |
|------------------|----------|--------|-------|
| Project list | Live org projects | WORKING | Loads `GET /api/v1/projects`; verified 7 rows |
| Create Project | Full form → saves project | **WORKING** | Real `create-project-modal.tsx` → `POST /api/v1/projects`; gated by `project:create` |
| Footer stats | Real counts | **WORKING** | Computed from loaded data |
| Import / Export / Ask AI | — | NOT_IMPLEMENTED (disabled) | `title="Not available yet"` |
| Search / Filters | Filter list | **WORKING** | Client-side search + health filter |

### Sprints page

| Feature / Button | Expected | Status | Notes |
|------------------|----------|--------|-------|
| Sprint list | Live sprints | WORKING | `GET /api/v1/sprints` (7 seeded) |
| Create Sprint | Form → saves sprint | **WORKING** | `create-sprint-modal.tsx` → `POST /api/v1/sprints`; gated `sprint:create` |
| Start/Complete sprint (row) | Row actions | **WORKING** | `POST /sprints/:id/start` and `.../complete` |
| Footer counts | Real | **WORKING** | Computed from loaded data |
| Search / Filters | Filter list | **WORKING** | Client-side search + status filter |

### Calendar page (rebuilt for correctness)

| Feature | Status | Notes |
|---------|--------|-------|
| Month grid | **WORKING** | Real current month, Monday-first weekday, correct days-in-month |
| Task deadline events | **WORKING** | Built from real `GET /api/v1/tasks` due dates |
| Prev / Next / Today nav | **WORKING** | Navigate months via `cursor` state |
| Schedule Insights | **WORKING** | Real counts: total deadlines, high-priority, busiest day |
| Team panel | **WORKING** | Real org members from `/employees`; fabricated availability removed |
| Add Deadline / Create Event / Filter / Ask AI | NOT_IMPLEMENTED | Honestly disabled |

### Sprint Detail page

| Feature | Status | Notes |
|---------|--------|-------|
| KPI strip | **WORKING** | Real points + bar, "Day X of N", blocked count, capacity |
| Board | **WORKING** | Real tasks by column; assignee names resolved |
| Metrics tab | **WORKING** | Real points summary; honest burndown placeholder |
| Planning / Retrospective tabs | NOT_IMPLEMENTED | "Not available yet" |
| Complete Sprint | **WORKING** | `POST /sprints/:id/complete` (gated) |

### Project Details page (rebuilt from 100% mock)

| Feature | Status | Notes |
|---------|--------|-------|
| Overview | **WORKING** | Real name/code/priority/health/progress/owner/PM/team/milestones/risks |
| Sprints tab | **WORKING** | Real sprints for this project |
| Releases tab | **WORKING** | Real releases for this project |
| Team tab | **WORKING** | Real project members + titles |
| Risks tab | **WORKING** | Real `project_risks` |
| Activity tab | **WORKING** | Real `project_activity` rows |
| Create Task | **WORKING** | Scoped to project, gated `task:create` |
| AI / Other tabs | NOT_IMPLEMENTED | Honestly disabled |

---

## Audit E — QA/Security, Documents, Analytics

### QA & Security

| Feature | Status | Notes |
|---------|--------|-------|
| Tables (Bugs/QA/Security/Compliance/Approvals) | WORKING | Real `/api/v1/qa`, `/security`, `/approvals` |
| Quality Summary panel | **WORKING** | Real derived counts |
| AI panel | NOT_IMPLEMENTED | Honestly disabled |
| Search | **WORKING** | Per-tab client search |

### Documents

| Feature | Status | Notes |
|---------|--------|-------|
| Document table | WORKING | Real `/api/v1/documents` |
| Left rail filters + search | **WORKING** | Drafts/Archived/Starred + category filter |
| Drafts badge | **WORKING** | Real count |
| Import / Template / AI | NOT_IMPLEMENTED | Honestly disabled |

### Analytics

| Feature | Status | Notes |
|---------|--------|-------|
| Sprint Velocity / Project Health / Work-by-Status charts | WORKING | Real data |
| KPI strip | **WORKING** | Derived: Avg Sprint Velocity, Completion Rate, Projects On Track % |
| Pie center | **WORKING** | Real on-track % |
| Cycle Time Trend | NOT_IMPLEMENTED | "Not available yet" |
| Other 7 tabs | NOT_IMPLEMENTED | "Not available yet" |

---

## Audit F — De-fake pass: Inbox / Overview / My Work (2026-06-28)

Three pages still surfaced hardcoded operational content. This pass removed **every** fabricated count, narrative, name, task ID, sprint, blocker, and activity row and replaced each with a real, organization/member-scoped query, plus realtime refresh and consistency tests.

### F1 — Inbox category counts
- Removed hardcoded `categories` array, fabricated AI Summary, fabricated Related Activity.
- All counts from one server-computed `counts` object; badges/list use shared `categoryOf` mapping.
- Inbox Zero vs empty-filter distinguished.

### F2 — Overview Intelligence Feed + charts + Priority table
- Real `signals[]`, real velocity from completed sprints, real Open_Tasks_By_Project, real blocked/overdue priority items.
- Realtime via `useTablesRealtime`.

### F3 — My Work rebuild
- Single member-scoped `GET /api/v1/my-work` endpoint (tasks/kpis/blockers/upcoming/recentActivity/sprint/approvals).
- KPIs + table from one source; AI Daily Brief hidden; fabricated drawer replaced; realtime via `useTablesRealtime`.

### F — Tests (6/6)
- Empty workspace + cross-company isolation, Inbox Zero, count consistency, pagination consistency.
- `scripts/verify-realtime.mjs` extended for live notification events.

---

## Files changed in functional audit

- `services/member.service.ts` — added `getAssignableMembers()` (project/team-scoped, excludes suspended + Client Viewers, returns title/team/role/capacity).
- `app/api/v1/projects/[projectId]/assignable-members/route.ts` — new endpoint, gated by admin/`task:create`/`task:assign`.
- `components/tasks/create-task-modal.tsx` — new full Create Task modal with filtered assignee dropdown.
- `components/tasks/kanban-board.tsx` — replaced title-only quick-add with the modal.
- `components/tasks/task-drawer.tsx` — added status select (`task:update`), reassign select (`task:assign`), comment author display, and @mention picker.
- `services/comment.service.ts` — `listComments` now embeds author profile (full_name, job_title).
- `services/member.service.ts` — `assertAssignable()`; `services/task.service.ts` — eligibility enforced on create/update/addAssignee.
- `app/api/v1/tasks/route.ts` + `[taskId]/route.ts` — require `task:assign` when request carries an assignee.
- `components/tasks/create-task-modal.tsx` — added start date, estimated hours, story points, security classification, acceptance criteria, additional assignees.

## Completed Fixes
- **2026-06-27 — Audit C: comment edit/delete + threaded replies:** Added `updateComment`/`deleteComment` + `PATCH`/`DELETE /api/v1/tasks/:taskId/comments/:commentId`. Wired Edit/Delete/Reply into `task-drawer.tsx`. Added `tests/integration/comment-edit-delete.test.ts` (4/4). **Verified live.** lint 0; vitest 39/39.
- **2026-06-27 — Audit A/B follow-ups:** Fixed 2 pre-existing `signup/page.tsx` lint errors. Epic field WORKING. Sign out verified. vitest 35/35.
- **2026-06-27 — Audit B:** Employee assignment wired end-to-end. Verified: UPI-116 created & assigned by pm@, dev@ received `TASK_ASSIGNED`. vitest 35/35.
- **2026-06-27 — Audit B hardening:** Backend now validates every assignment (`assertAssignable`), requires `task:assign`, added `data-testid` hooks. vitest 35/35.

## Known issues / next
1. Per-comment attachments (task-level upload already works).
2. Two-window live realtime click-through.
3. Add Playwright coverage for: PM create+assign, employee My-Work visibility, eligible-dropdown filtering, cross-org 403.

---

# 7. Responsive Audit

| Page | Viewport | Issue Found | Fix Applied | Scroll Behavior | Test Result |
|------|----------|-------------|-------------|-----------------|-------------|
| Shell (`layout.tsx`, `shell.tsx`) | All | Sidebar didn't collapse on mobile. Global overflow issues. | Used `min-h-dvh`. Implemented sliding mobile drawer. | Body organic scroll disabled. Drawer scrolls internally. Main content scrolls. | PASS |
| Auth (`login`, `signup`, `select-workspace`) | Mobile | Side-by-side flex broke on small screens. Used fixed `min-h-screen`. | Changed to `flex-col lg:flex-row`. Used `min-h-dvh`. | Organic scroll on body. | PASS |
| Projects List | Mobile | Tables overflowed page. Hardcoded `calc(100vh)`. | Removed hardcoded height. Wrapped table in `overflow-x-auto`. | Vertical page scroll. Horizontal table scroll. | PASS |
| Project Detail | Mobile | Tabs hardcoded `h-[calc]`. Grid forced columns. | Replaced with organic flow. `grid-cols-1 lg:grid-cols-3`. | Vertical page scroll. | PASS |
| Kanban Board | Mobile | Drag columns squished or broke layout. | Maintained `w-72` columns, wrapped in `overflow-x-auto scrollbar-thin`. | Horizontal container scroll. | PASS |
| Drawers (`task-drawer`) | Mobile | Drawer was clipped or positioned right, not full width. | `w-full`, `h-[100dvh]`, slide-in animations adjusted. Grid items stacked. | Internal drawer scroll. | PASS |
| Modals (`create-*-modal`) | Mobile | Small modals clipped on mobile keyboards. | Converted to full-screen drawers on mobile (`items-end`, `h-[100dvh]`). Action bar pinned. | Internal content scroll. | PASS |
| About Page (`/about`) | Mobile/Tablet | Complex content elements and developer profile card. | Stacked section layout and wrapped developer profile links vertically. | Vertical page scroll. | PASS |
| Contact Page (`/contact`) | Mobile/Tablet | Standard contact form layout on narrow viewports. | Stacked multi-column form inputs and text area full-width on mobile. | Vertical page scroll. | PASS |
| Privacy Page (`/privacy`) | Mobile/Tablet | Large text blocks and layout readability. | Constrained legal text width using `max-w-3xl`. | Vertical page scroll. | PASS |
| Terms Page (`/terms`) | Mobile/Tablet | Large text blocks and layout readability. | Constrained legal text width using `max-w-3xl`. | Vertical page scroll. | PASS |

---

# 8. Testing

## End-to-End Tests (Playwright)

E2E tests drive the real app + local Supabase across separate authenticated
role sessions (Owner, PM, Team Manager, Developer) and an unauthorized org.

### Prerequisites

1. Local Supabase running and seeded:
   ```bash
   npx supabase start
   npx supabase db reset
   ```
   If auth returns 502 right after a reset (Kong cached the old container IP):
   ```bash
   docker restart supabase_kong_handoff supabase_rest_handoff supabase_edge_runtime_handoff
   ```
2. Browsers installed once: `npx playwright install chromium`

### Run

E2E runs against a **production build** (fast, no on-demand compile). Stop any
`next dev` first, then:

```bash
npm run build
npm run start &          # serves http://localhost:3000
npm run test:e2e
```

`playwright.config.ts` has `webServer.reuseExistingServer: true`, so it reuses a
running server (or starts `npm run dev` if none — but prod is recommended).

### What is covered (`tests/e2e/role-workflows.spec.ts`)

| # | Workflow | Type |
|---|----------|------|
| 1 | Signup → create company → becomes ORG_OWNER | UI + API |
| 2+4 | PM creates & assigns a task → employee sees it in My Work | API |
| 3 | Employee UI gated: no Init_Task, Analytics hidden, personal overview | UI |
| 3b | Employee blocked from project create / task assign (403) | API |
| 5 | Realtime: task created live appears on PM board without refresh | UI realtime |
| 6 | Comment @mention → PM receives a notification | API |
| 7 | Team Manager sees only team-connected projects (UPI only) | API |
| 8 | Cross-org user cannot read Apex projects/tasks | UI + API |
| 9 | Release cannot deploy without required approvals (403) | API |

`tests/e2e/auth.setup.ts` logs in each role once and saves
`tests/e2e/.auth/<role>.json` storage states (gitignored).

### Notes
- `retries: 1` absorbs realtime timing flake; deterministic tests pass first try.
- Tests create some rows (tasks, orgs); run `npx supabase db reset` to clean.

---

# 9. Implementation Tracker

## Current Sprint Goal
Execute Security Hardening Phase and AI Integration Safety checks, moving from functional fixes to robust multi-tenant enterprise security.

## Recent Work

### Completed:
Security A — Baseline Audit, Secrets, Environment Safety, Dependency Review

### Known blockers:
[node_modules/next/node_modules/postcss] postcss <8.5.10 (Moderate, Prod) - Blocked by Next.js downgrade.
[node_modules/firebase-tools] uuid <11.1.1 (Moderate, Dev) - Blocked by firebase-tools downgrade.

### Next task:
Security B — Route Authorization, Organization Isolation, and Supabase RLS Audit

---

## Project Status

- Product: Handoff
- Environment: Local development only
- Frontend: Next.js (App Router, TS)
- Backend: Local Supabase + PostgreSQL (project id `handoff`)
- Realtime: Supabase Realtime
- Current overall status: IN PROGRESS
- Last updated: 2026-06-29
- Current phase: Action Button Backend Wiring - Group A implemented at code level. Add Deadline, Project Import, Project Export CSV, and Sprint Export CSV now use real APIs, permissions, RLS-backed tables, audit records, and truthful unavailable states for PDF. Targeted integration passes; browser persistence/realtime verification remains pending before marking the new actions WORKING.

---

## Recent Work Log

### 2026-06-29 — Phase A: QA & Security Buttons Implementation

Fully implemented backend and frontend wiring for the QA & Security action buttons ("Create Bug", "Create Test Plan", "Start Security Review"):

- **Migrations:** `supabase/migrations/0047_qa_security_phase_a.sql` created, adding `bug_assignees`, `test_plan_tasks` (many-to-many), `security_review_assignees`, and other missing entities. Implemented atomic SECURITY DEFINER RPCs (`create_bug`, `create_test_plan`, `start_security_review`) for safe transaction creation.
- **Validation:** Added `lib/validation/qa-security.ts` with strict Zod validation schemas.
- **Services:** Created `bug.service.ts`, `test-plan.service.ts`, and `security-review.service.ts` to manage RPC calls and audit logging.
- **APIs:** Created `app/api/v1/bugs/route.ts`, `app/api/v1/test-plans/route.ts`, and `app/api/v1/security-reviews/route.ts` with org resolution and permission checks.
- **UI:** Replaced `MockActionButton`s in `app/dashboard/qa-security/page.tsx` with real modals: `CreateBugModal`, `CreateTestPlanModal`, and `StartSecurityReviewModal`.
- **Empty States:** Updated `page.tsx` table to show truthful empty states for Bugs, QA Testing, Security Reviews, Compliance, and Approvals when no data is found.
- **Tests:** Ran unit tests successfully (`27 passed`).

### 2026-06-29 — Private task visibility: live browser RLS verification + migration 0045 hotfix

Browser-verified the complete private-task visibility feature against the running local Supabase using real JWT sessions (Chrome MCP):

- **UPI-106** created as `PRIVATE_ASSIGNMENT` assigned to Dev Rao via `POST /api/v1/tasks` — 201, correct scope.
- **PM** (reporter + project manager) — sees task in board and via direct API — ✅
- **Dev Rao** (primary assignee) JWT → Supabase REST SELECT — 1 row returned — ✅
- **QA Engineer** (not on task) JWT → 0 rows for task, comments, assignees, activity — ✅ all hidden
- **Security Engineer** (unrelated) JWT → 0 rows — ✅ hidden
- **PROJECT_SHARED** flip: QA can see the task; reset to PRIVATE blocks them again — ✅
- **Task drawer** shows `PRIVATE ASSIGNMENT` visibility scope + assignment history — ✅

**Bug found and fixed:** migration 0044 added `handoff.can_set_task_visibility()` but did NOT wire it into the `tasks_update` WITH CHECK. Fixed in `supabase/migrations/0045_wire_visibility_scope_into_update_policy.sql`.

**Second bug found and fixed (migration 0046):** migration 0043 used unqualified `id` inside sub-queries. Fixed with explicit `tasks.id` qualifiers.

**Fully verified — all outstanding items closed:**
- Integration suite: **8/8 tests pass** ✅
- Realtime leak test: qa@ → **0 data events** ✅

### 2026-06-29 — Private task visibility — visibility scope permission guard (gap fix)

- **Migration:** `supabase/migrations/0044_visibility_scope_permission_guard.sql`
- **API routes:** POST and PATCH check `m.roles` before allowing broader scope.
- **Tests:** Expanded to 11 scenarios.
- **Verification:** DB reset, lint, typecheck, unit tests all clean.

### 2026-06-29 — Private task visibility and assignment history

- **Migration:** `supabase/migrations/0042_private_task_visibility.sql`
- **Policy change:** private tasks visible only by direct task relationship, explicit grant, responsible manager/admin authority.
- **Verification:** DB reset, lint, typecheck, unit tests passed.

### 2026-06-29 — Group A action buttons backend-connected

- **Migration:** `supabase/migrations/0041_group_a_actions.sql`
- **APIs/services:** project-deadlines, project import, project/sprint CSV export.
- **Verification:** lint, typecheck, unit tests, integration (6/6), build, DB reset passed.

### 2026-06-28 — Governance record detail surfaces → AI citations fully clickable ✅ COMPLETE

Closed the one remaining blocker from the AI Intelligence work. Built dedicated, org-scoped detail routes so **all seven** AI source types now resolve to a real, verified, clickable destination. `npm run lint` = 0 · `npx vitest run` = **62/62**.

### 2026-06-28 — AI Intelligence intents: audit + UI wiring + tests

| Intent | Permissions (+ `ai:use`) | Data sources | Source types cited | Empty/unavailable state |
| --- | --- | --- | --- | --- |
| **My Focus** | `task:view` | `tasks` (assigned, open) | `task` | "You have no open assigned tasks right now." |
| **QA & Security Digest** | `qa:view` OR `security:view` | `bugs`, `tasks` (QA_TESTING), `security_reviews` | `bug`, `task`, `security_review` | "No open bugs, QA tasks, or pending security reviews found." |
| **Release Readiness** | `release:view` | `releases`, `approval_requests` | `release`, `approval_request` | "No in-flight releases or pending approvals found." |
| **Executive Briefing** | `analytics:view` | counts over `projects`/`tasks`/`bugs`/`security_reviews` + open `incidents` | `incident` | "No project or work-item data is available yet for a briefing." |

### 2026-06-28 — Command palette (⌘K)

New `components/dashboard/command-palette.tsx`. Global `⌘K`/`Ctrl+K` listener. Searches permission-filtered nav items + live org tasks. vitest 48/48.

### 2026-06-28 — Honest AI: source citations now verifiable + deep-linkable

Threaded task id through AI context. `ai_sources.source_id` now persisted. vitest **48/48**.

### 2026-06-28 — Actionable Inbox: snooze now functional

`listNotifications` now filters out notifications whose `snoozed_until` is in the future. vitest **48/48**.

---

## Rules

- Do not mark work complete unless it uses real local Supabase data.
- Do not mark work complete unless permissions are enforced in UI, API, and RLS where applicable.
- Do not mark realtime complete unless tested with two browser sessions.
- Completed tasks move to Completed History, not deleted.
- Never push to Git or deploy unless explicitly requested.
- Never run `npm run build` while `next dev` is running — both use `.next` and it corrupts the dev server.

---

## Baseline (Phase 0 Audit — 2026-06-27)

Baseline checks: **`npm run lint` = 0 problems · `npx vitest run` = 21/21 passed · `npm run build` = success**.

### Already implemented
- Multi-tenant schema, 12 migrations, every business table has `organization_id`, `created_at/updated_at` + triggers, archive fields.
- RLS enabled on all business tables. Helpers in `handoff` schema.
- Auth (signup/login/onboarding/signout), middleware route guard, browser/server/admin Supabase clients.
- ~70 API routes under `app/api/v1`.
- Realtime hooks + live Kanban + notification bell. Two-browser + headless verified.
- All dashboard pages wired to live data.
- Mock AI provider, seed (org Apex + 7 demo users, 7 projects, 105 tasks).
- Tests: `tests/unit/*`, `tests/integration/*`.

### Gaps vs. the new role-based multi-company spec

| # | Area | Status | Gap |
|---|------|--------|-----|
| 1 | Roles | PARTIAL | No `ORG_OWNER`, no `TEAM_MANAGER`; no `qa:view`/`qa:update` perms. |
| 2 | RLS helpers | PARTIAL | No `is_team_manager(team_id)`; team-scoped `task:assign` not enforced. |
| 3 | Overview dashboard | MISSING | `app/dashboard/page.tsx` shows identical view to all roles. |
| 4 | UI permission gating | MISSING | No permission context/hook; action buttons + nav always shown. |
| 5 | Onboarding | PARTIAL | Single-step `/onboarding` only. |
| 6 | Invite flow | MISSING | `organization_invites` table unused. |
| 7 | Developer-status page | MISSING | No `/dashboard/settings/developer-status`. |
| 8 | Org switcher UI | MISSING | `GET /api/v1/organizations` exists; no switcher. |
| 9 | Active-org context | PARTIAL | Always picks first membership; no cookie/header-scoped active org. |

---

## Current Phase
Responsive Layout, Screen Adaptation, and Scroll Usability

### Phase checklist

**Audit A — Authentication, company isolation, roles — PASS**
- [x] Verified login, middleware guard, all-routes auth, RLS cross-org isolation, secret confinement, role UI gating, API role boundary.

**Audit B — Task creation + employee assignment — FIXED & VERIFIED**
- [x] New `getAssignableMembers()` + `assignable-members` endpoint.
- [x] Create Task modal, drawer status/reassign, assignment notifications.
- [x] Server-side `assertAssignable()`, `task:assign` enforcement, `data-testid` hooks.
- [x] Epic field WORKING, signup lint fixed, sign out verified.

**Audit C — Employee updates, comments, mentions, notifications, realtime — CORE WORKING**
- [x] Comment author display, @mention picker, edit/delete/reply.
- [ ] Per-comment attachments; two-browser realtime walkthrough.

**Public Website Information and Legal Pages**
- [x] About, Contact, Privacy, Terms pages.
- [x] Secure `POST /api/v1/contact` with honeypot + rate limiting.
- [x] RLS on `contact_requests`.

**Auth phases (A–F)**
- [x] Auth A: Database, username, roles, invite security.
- [x] Auth B: Login with username/email.
- [x] Auth C: Company owner signup and onboarding.
- [ ] Auth D: Project team creation permissions.
- [ ] Auth E: Invite acceptance and Admin user management.
- [ ] Auth F: UI permission checks and automated tests.

### Possible future work (not started)
- Real email delivery for invites (currently local: accept URL returned in API).
- Avatar/document upload UIs (attachments upload is wired; buckets exist for all).
- Slack/Teams/GitHub real integrations (currently mock).

---

## Current Blockers
- Browser persistence/realtime verification for Group A actions has not been run yet.
- Full integration verification needs the local Supabase env loaded into the Vitest command environment.

---

## Next Exact Task
1. Browser-verify Group A actions end-to-end.
2. Mark verified Group A rows WORKING only after browser refresh/realtime verification passes.
3. Run the full integration suite, then continue with Group B.

---

## Completed History

### 2026-06-28 — Audit F (final regression): production build fixed (6 real bugs) + full smoke pass
- **`npm run build` surfaced 6 real type/runtime bugs** that lint + vitest + `next dev` all missed.
- After fixes: build succeeds, all 30+ pages built.
- Browser smoke: no console errors on any page.

### 2026-06-28 — Audit E (QA/Security, Documents, Analytics de-faked) + shell lint fixes
- Removed all fabricated panels/numbers from QA/Security, Documents, Analytics.
- lint **0**, vitest 41/41.

### 2026-06-28 — Audit D (Projects + Sprints search/filter wired) + fixed dev-crashing duplicate route
- Wired client-side search + filters for Projects and Sprints.
- Fixed duplicate dynamic route (`[id]` vs `[notificationId]`) that crashed dev server.

### 2026-06-27 — Audit D (Sprint Detail page made real)
- Rebuilt on `GET /api/v1/sprints/:id`.

### 2026-06-27 — Audit D (Project Details rebuild + Sprint row actions)
- Project Details rebuilt from 100% mock to real data.
- Sprint Start/Complete row actions wired.

### 2026-06-27 — Audit D (Calendar rebuild + Sprints)
- Calendar rebuilt for correctness (was hardcoded October 2026).
- Create Sprint modal wired.

### 2026-06-27 — Audit D (Projects): real Create Project + fixed a deep project-creation RLS bug
- Create Project was a dead button. Built real modal.
- Fixed PostgREST snapshot isolation RLS bug via SECURITY DEFINER RPC.

### 2026-06-27 — Audit C: comment edit / soft-delete / threaded replies
- Full comment lifecycle wired.

### 2026-06-27 — Phases R4–R7: Storage, team visibility, custom roles, Playwright E2E
- Storage buckets + RLS, team-on-project visibility, custom roles, 13 E2E tests.

### 2026-06-27 — Phase R3: Developer-status page + owner access fix
- Dev status page, ORG_OWNER project access fix.

### 2026-06-27 — Phase R2: Onboarding, invites, org switcher
- Multi-step onboarding, invite acceptance, org switcher.

### 2026-06-27 — Phase R1: Roles, permissions, active-org, UI gating
- ORG_OWNER + TEAM_MANAGER roles, permission context, role-scoped dashboard.

### 2026-06-28 — Real Gemini AI integration + frontend fixes
- Replaced mock AI with real Gemini. One streaming SSE endpoint for all intents.

### 2026-06-26 / 2026-06-27 — Foundational build (Phases 1–8)
- Migrations 0001–0012; full multi-tenant schema + RLS; ~70 API routes; services layer; realtime; mock AI; seed; tests (21 passing).

---

## Test History
- 2026-06-27: `npx vitest run` → 21/21 passed.
- 2026-06-27: `node scripts/verify-realtime.mjs` → PASS.
