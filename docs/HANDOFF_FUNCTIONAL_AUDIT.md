# Handoff — Functional Audit

Living record of every interactive item checked, its real (backend-connected) status, and the fix applied.

- Environment: local dev (`next dev` on :3000) + local Supabase (:54321)
- Method: code inspection + live browser/API verification with seeded demo accounts + `vitest` (35/35) baseline.
- A feature is **WORKING** only when: UI → secure API → validation → permission check → Supabase read/write → (audit log / realtime / notification where required) → correct after refresh. Temporary frontend-only changes do **not** count.

**Status legend:** `WORKING` · `PARTIAL` · `UI_ONLY` · `BROKEN` · `BLOCKED_BY_BACKEND` · `NOT_IMPLEMENTED` · `NOT_APPLICABLE`

**Seeded demo accounts** (password `Password123!`): `owner@`, `admin@`, `pm@`, `tm@`, `dev@`, `qa@`, `sec@`, `audit@`, `client@` `apexfintech.test`.

---

## Private Task Visibility & Assignment History (2026-06-29)

| Surface | Expected Behavior | Current Status | Backend / DB | Permission | Notes |
|---------|-------------------|----------------|--------------|------------|-------|
| Tasks RLS | Private tasks do not appear to unrelated project members | IMPLEMENTED / INTEGRATION BLOCKED | `handoff.can_view_task`, `tasks.visibility_scope` | `task:view` plus record grant | Migration applied via DB reset; focused integration blocked by local Supabase HTTP timeout after reset. |
| Task detail URL | Hidden task ID shows generic forbidden state | IMPLEMENTED | RLS-backed task query | `task:view` | Avoids helpful record-existence signals for inaccessible tasks. |
| Create task | Private by default, optional broader visibility | IMPLEMENTED | `visibility_scope` persisted | `task:create`; `task:assign` when assigning | UI selector added; DB default is `PRIVATE_ASSIGNMENT`. |
| Broader visibility scope | Only admin/owner/PM may set PROJECT_SHARED or ORGANIZATION_VISIBLE | IMPLEMENTED | `handoff.can_create_task_with_visibility` (0049), API route guard | role check in POST and PATCH routes | Regular employees get 403 before hitting RLS. |
| Reassign task | Preserve old assignment row and add/promote new primary row | IMPLEMENTED | `task_assignees.removed_at`, `assignment_type` | `task:update` + `task:assign` | Bulk reassignment disabled to prevent history bypass. |
| My Work / AI focus | Use the same RLS-visible private-task set | IMPLEMENTED | Supabase RLS on `tasks` | caller permissions | Includes additional/reviewer/explicit/manager/admin-visible work. |
| Task drawer | Show visibility and assignment history | IMPLEMENTED | `task_assignees` embed | `task:view` | Hidden by RLS when caller cannot view the task. |

Focused coverage added in `tests/integration/private-task-visibility.test.ts` (11 scenarios); see `docs/HANDOFF_PRIVATE_TASK_VISIBILITY_AUDIT.md` for the rule matrix and current verification blocker.

---

## Action Buttons Group A - Backend Wiring (2026-06-29)

This pass started the action-button backlog from `docs/HANDOFF_ACTIONS_BACKEND_AUDIT.md`. Scope was limited to Group A: project/sprint/calendar operational actions that already had UI affordances but were either disabled, mocked, or missing backend persistence.

| Page | Action | Status | Backend / DB | Permission | Notes |
|------|--------|--------|--------------|------------|-------|
| Calendar | Add Deadline | PARTIAL | `POST /api/v1/project-deadlines`, `project_deadlines`, `project_activity`, `audit_logs`, optional `notifications` | `deadline:create` or `project:update` | Real modal writes project deadlines and subscribes Calendar to `project_deadlines`; browser persistence pass still pending. |
| Projects | Import | PARTIAL | CSV preview/confirm APIs, `import_jobs`, `import_rows`, `projects`, `audit_logs` | `project:import` | Real CSV upload, mapping, validation, valid-row insert summary; browser persistence pass still pending. |
| Projects | Export Report | PARTIAL | `GET /api/v1/projects/export`, `report_exports`, `audit_logs` | `report:export` | Real CSV download. PDF export is truthfully unavailable, not fake. |
| Sprints | Export Sprint Report | PARTIAL | `GET /api/v1/sprints/export`, `report_exports`, `audit_logs` | `report:export` or `sprint:view` | Real CSV download. PDF export is truthfully unavailable, not fake. |
| Projects | Create Project | WORKING | Existing `POST /api/v1/projects`, `projects`, `project_activity`, `audit_logs` | `project:create` | Already working from Audit D; remains permission-gated. |
| Sprints | Create Sprint | WORKING | Existing `POST /api/v1/sprints`, `sprints`, `audit_logs` | `sprint:create` | Already working from Audit D; remains permission-gated. |

Verification in this pass:

- `npm.cmd run lint` passed.
- `npx.cmd tsc --noEmit` passed.
- `npx.cmd vitest run tests/unit` passed (27 tests).
- `npx.cmd vitest run tests/integration/group-a-actions.test.ts --maxWorkers=1` passed (6 tests) when the command environment loaded `.env.local` and mapped local CLI keys to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
- `npm.cmd run build` passed.
- `npx.cmd supabase db reset` passed and applied `supabase/migrations/0046_group_a_actions.sql`.
- Full `npx.cmd vitest run` without preloaded env still fails before integration execution because `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is absent from the command environment.

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

**Audit A verdict:** authentication, company isolation, and role enforcement are functioning against real Supabase data at UI, API, and RLS layers. Two low-priority follow-ups (sign-out re-test, org-switcher re-test with a fresh multi-org user).

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

**Audit B verdict:** the critical create→assign→notify→My Work→status-update workflow now works end-to-end on real Supabase data with correct role and org scoping. Secondary Create-Task fields remain for a follow-up pass.

---

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
| Board/Drawer | Realtime task/comment | Live updates across sessions | WORKING | Yes (`use-board-realtime`/`use-task-realtime`) | — | Postgres-changes subscriptions; see realtime doc |
| Task Drawer | Edit own comment | Edit own comment, mark edited | WORKING | Yes (`PATCH /tasks/:taskId/comments/:commentId`) | admin@ | Edited "Admin comment…" → "Admin comment EDITED via UI"; shows "· edited"; DB `edited_at` set. RLS + service author-check enforce ownership |
| Task Drawer | Delete own comment | Soft-delete, keep thread | WORKING | Yes (`DELETE /tasks/:taskId/comments/:commentId`) | admin@ | Deleted → renders "[deleted]", row survives; DB `deleted_at` set |
| Comment routes | Ownership enforcement | Non-author cannot edit/delete | WORKING | Yes (RLS `comments_update_own` + service 403) | pm@/dev@ | New `tests/integration/comment-edit-delete.test.ts` (4/4): author edits/soft-deletes; non-author update → 0 rows |
| Task Drawer | Threaded replies | Reply nests under parent | WORKING | Yes (`parent_comment_id`) | admin@ | Reply rendered indented under parent w/ left border; DB `parent_comment_id` set |
| Task Drawer | Attach file to comment | File on comment | PARTIAL | Task-level attachments work | — | Per-comment attach not wired (task-level upload works) |

**Audit C verdict:** the employee-collaboration loop (status update → comment → @mention → notification → realtime) plus comment edit/delete/threaded-reply now all work on real Supabase data, refresh-safe and ownership-enforced. Remaining: per-comment attachments (task-level works), and a two-window realtime click-through (subscriptions verified in code + via single-session live tests).

---

## Audit D — Projects / Sprints / Calendar (in progress)

### Projects page (`app/dashboard/projects/page.tsx`)

| Feature / Button | Expected | Status (before) | Status (now) | Notes |
|------------------|----------|-----------------|--------------|-------|
| Project list (table/grid) | Live org projects | WORKING | WORKING | Loads `GET /api/v1/projects`; verified 7 rows render (earlier "0" was a screenshot-timing artifact, not a bug) |
| Create Project | Full form → saves project | **BROKEN (dead button)** | **WORKING** | "Initialize Project" had **no onClick** — pure UI. Replaced with real `components/dashboard/create-project-modal.tsx` → `POST /api/v1/projects`; gated by `project:create`; real PM dropdown from `/employees`. **Verified live:** created RPCFIX & PMVERIFY (201), persisted, with `project_activity` + `audit_logs` rows; PM assignment persists |
| Footer stats | Real counts | **UI_ONLY (hardcoded "Showing 7 · 4 On Track…")** | **WORKING** | Now computed from loaded data (`projects.length`, health filters) |
| Import / Export Report / Ask Handoff AI | — | UI_ONLY (no-op) | NOT_IMPLEMENTED (honestly disabled) | Disabled with `title="Not available yet"` — no longer silently do nothing |
| Create Project button visibility | Hidden without perm | always shown | WORKING | Gated by `project:create` via `usePermission` |
| Search / Filters | Filter list | UI_ONLY | UI_ONLY | Still cosmetic — logged for a later pass (not faked as working) |

#### Deep bug found & fixed — project creation was impossible for ANY user
Creating a project failed for fully-authorized ORG_ADMIN/ORG_OWNER with `new row violates row-level security policy for table "projects"`. **Root cause** (diagnosed via in-policy logging — `uid=…001 org=…a0 hp=t`, i.e. the INSERT WITH CHECK passed): PostgREST issues `INSERT … RETURNING projects.*`, and the RETURNING row is re-checked against `projects_select` → `handoff.can_view_project(id)`, which does `select organization_id from projects where id = p_project`. The just-inserted row isn't visible to that sub-select's snapshot → returns false → whole statement rejected. Masked until now because the Create button was a dead no-op. **Fix:** `supabase/migrations/0025_create_project_rpc.sql` — `public.create_project(p_org, p_payload)` SECURITY DEFINER RPC (same pattern as `create_organization`/`create_project_team`); enforces `project:create`, inserts, returns the row without the RETURNING→SELECT round-trip. `services/project.service.ts` now calls the RPC. Test: `tests/integration/create-project.test.ts` (2/2 — owner creates+reads back, dev → forbidden).

### Sprints page (`app/dashboard/sprints/page.tsx`)

| Feature / Button | Expected | Status (before) | Status (now) | Notes |
|------------------|----------|-----------------|--------------|-------|
| Sprint list | Live sprints | WORKING | WORKING | `GET /api/v1/sprints` (7 seeded) |
| Create Sprint | Form → saves sprint | UI_ONLY (no-op) | **WORKING** | New `components/dashboard/create-sprint-modal.tsx` → `POST /api/v1/sprints`; gated by `sprint:create`; real project dropdown. **Verified:** created "Audit D Test Sprint" (201) |
| Footer counts | Real | UI_ONLY (hardcoded "5 sprints · 3 Active…") | **WORKING** | Computed from loaded data |
| Export / Ask AI / Start Sprint (header) | — | UI_ONLY | NOT_IMPLEMENTED (honestly disabled) | Export/Ask-AI disabled `title="Not available yet"`. Header "Start Sprint" removed (ambiguous which sprint); per-row Start is next (`/sprints/:id/start` exists) |

### Calendar page (`app/dashboard/calendar/page.tsx`) — rebuilt for correctness

Before: a hardcoded **"October 2026"** grid with a fixed Wednesday start while events were filtered to the *current* month — so events never aligned with the labelled grid; plus fabricated "Schedule Insights" (Conflict Detected / Overloaded Day) and a fabricated "Team Availability" list (Sarah Chen, etc.).

| Feature | Status (before) | Status (now) | Notes |
|---------|-----------------|--------------|-------|
| Month grid | BROKEN (fake Oct 2026, wrong weekday offset) | **WORKING** | Renders the real current month with correct Monday-first weekday alignment + real days-in-month. Verified: June 2026, Jun 1 under MON, today (27) highlighted on SAT |
| Task deadline events | PARTIAL (current-month only, misaligned) | **WORKING** | Built from real `GET /api/v1/tasks` due dates; placed on correct cells (per-cell scroll for busy days). Verified events on Jun 27–30 |
| Prev / Next / Today nav | UI_ONLY | **WORKING** | Navigate months via `cursor` state; events + insights re-filter per displayed month |
| Month / Agenda view | UI_ONLY | WORKING | Agenda = chronological list of the month's events |
| Schedule Insights | **UI_ONLY (fabricated)** | WORKING (derived) | Real counts: total deadlines, high-priority count, busiest day — or honest "No deadlines" empty state |
| Upcoming This Week | PARTIAL | WORKING | Real events in the next 7 days |
| Team panel | **UI_ONLY (fabricated names/statuses)** | WORKING (real members) | Real org members from `/employees` (name + title); fabricated availability statuses removed (availability tracking NOT_IMPLEMENTED) |
| Layer toggles | UI_ONLY (hardcoded active) | WORKING (local) | Now real local toggles |
| Add Deadline / Create Event / Filter / Ask AI | UI_ONLY | NOT_IMPLEMENTED (honestly disabled) | Disabled `title="Not available yet"` |
| Event drawer | WORKING (fake fields) | WORKING | Real date/priority/project; "Open in Tasks" link; removed fake attendees/location/reminders |

### Sprints per-row actions + Project Details (this pass)

| Page | Feature | Status (before) | Status (now) | Notes |
|------|---------|-----------------|--------------|-------|
| Sprints | Start sprint (row) | none | **WORKING** | Planning rows show **Start** → `POST /sprints/:id/start` (gated `sprint:start`). Verified: PLANNED→ACTIVE (200, persisted) |
| Sprints | Complete sprint (row) | none | **WORKING** | Active rows show **Complete** → `POST /sprints/:id/complete` (gated `sprint:complete`). Verified: ACTIVE→COMPLETED (200, persisted) |
| Project Details (`projects/[projectId]`) | Whole page | **UI_ONLY (100% mock — same "UPI Refund System / R. Gupta" for every id)** | **WORKING** | Rebuilt on `GET /api/v1/projects/:id`. Real name/code/priority/health; **real progress** computed from project tasks (done/total); real dates/budget/effort/classification; **owner & PM resolved to real names**; real team (project_teams + members) with avatars; **real milestones**; **real open risks**. Empty fields show "—" honestly. Verified live (UPI): 14% complete, Owner Ava Admin, PM Pat Manager, Team Payments Platform, milestone "Phase 1 Delivery", risk "Integration dependency risk" |
| Project Details | Create Task | UI_ONLY (no-op) | **WORKING** | Wired to `CreateTaskModal` scoped to this project (gated `task:create`) |
| Project Details | Project AI / weekly report / analyze deps | UI_ONLY (+ **fabricated AI narrative**) | NOT_IMPLEMENTED (honest) | Fabricated "Handoff Status Report" narrative removed; AI button disabled `title="Not available yet"` |
| Project Details | Board/Backlog tabs | placeholder | PARTIAL | Link to the Task Board; other tabs show honest "Not available yet" (were "Select Overview to see the primary implementation") |

### Sprint Detail page (`app/dashboard/sprints/[sprintId]`) — this pass

Before: real Board, but a KPI strip full of hardcoded values ("Day 11 of 14", velocity 42, "+2 from last sprint", "2 Blocked Items", "6 Members"), a **fabricated burndown chart** (hardcoded 12-point array), **fabricated AI analysis** + **fabricated blocked-work** (PAY-212/PAY-240), a **fabricated backlog** (PAY-251…), a fully-**fabricated Retrospective**, and `alert()`/`Mock AI Action` handlers.

| Feature | Status (before) | Status (now) | Notes |
|---------|-----------------|--------------|-------|
| KPI strip | UI_ONLY (mostly fabricated) | **WORKING (real/derived)** | Goal, Points (completed/planned + bar), Timeline ("Day X of N" computed from real dates), Remaining points, **Blocked count** (real), Capacity + **distinct assignee count** (real). Removed velocity/"+2"/fake members |
| Status badge | UI_ONLY (always green) | WORKING | Colored by real status (ACTIVE/PLANNED/COMPLETED) |
| Board | WORKING (ids only) | WORKING (improved) | Real tasks by column; **assignee names resolved** (member id → name); real type + story points; Blocked column. Verified: FRAUD Sprint 1 — TO DO 3 / IN PROGRESS 4 / CODE REVIEW 2 / QA 2, names Quinn Tester/Sam Secure/Dev Rao |
| Metrics tab | UI_ONLY (fabricated chart + AI + blocked) | **WORKING** | Real points summary (45/7/38, 16%) + honest "burndown chart not available yet"; **real Blocked Work** list (FRAUD work item 6). Fabricated AI/PAY-* removed |
| Planning / Retrospective tabs | UI_ONLY (fabricated) | NOT_IMPLEMENTED (honest) | Now "Not available yet" (were fake backlog/retro + alert() buttons) |
| Complete Sprint | PARTIAL (confirm()/alert()) | WORKING | `POST /sprints/:id/complete` (gated `sprint:complete`), refreshes; no fake dialogs |
| Sprint Insights / AI | UI_ONLY (alert mock) | NOT_IMPLEMENTED (honest) | Disabled `title="Not available yet"` |

**Audit D verdict (so far):** Projects, Project Details, Sprints (list + create + row actions + **detail page**), and Calendar all run on real Supabase data with no fabricated numbers/panels; dead controls are either wired or honestly disabled. Remaining Audit D: deeper Project-Details tabs (Timeline/Roadmap/Releases/etc.) and wiring the cosmetic Projects/Sprints search/filter inputs.

## Audit E — QA/Security, Documents, Analytics (releases surfaced via tabs)

All three pages already loaded real data into their tables/charts; this pass removed the remaining **fabricated panels/numbers** and **dead controls**.

### QA & Security (`app/dashboard/qa-security/page.tsx`)
| Feature | Status (before) | Status (now) | Notes |
|---------|-----------------|--------------|-------|
| Bugs / QA / Security / Compliance / Approvals tables | WORKING | WORKING | Real `/api/v1/qa`, `/security`, `/approvals`; unknown cols honestly "—" |
| Right "Release Readiness" panel | **UI_ONLY (fabricated — "Target: REL-42", hardcoded checklist)** | **WORKING (real)** | Replaced with a **Quality Summary** derived from loaded data: open bugs, critical bugs, security reviews in progress, compliance needing attention, approvals pending. Verified live: 21/7/7/2/0 |
| Right "AI Assistant" panel | **UI_ONLY (fabricated "Release 42 blocked… BUG-402… SOC2")** | NOT_IMPLEMENTED (honest) | Narrative removed; "AI analysis not available yet"; buttons disabled |
| Header: Start Security Review / Create Test Plan / Create Bug / Ask AI | UI_ONLY (no-op) | NOT_IMPLEMENTED (disabled) | `title="Not available yet"` |
| Search | UI_ONLY | **WORKING** | Per-tab client search; footer shows real `Showing N … (filtered)`. Verified: "FRAUD" → 3 bugs |
| Filters button | UI_ONLY | NOT_IMPLEMENTED (disabled) | — |

### Documents (`app/dashboard/documents/page.tsx`)
| Feature | Status (before) | Status (now) | Notes |
|---------|-----------------|--------------|-------|
| Document table | WORKING | WORKING | Real `/api/v1/documents` |
| Left rail filters + category rail | **UI_ONLY (didn't filter)** | **WORKING** | Drafts/Archived/Starred + category now filter the table; Recently-Viewed/Shared-with-me not tracked (no extra filter). Verified: Archived → honest "No documents." |
| "Drafts" badge | **UI_ONLY (hardcoded "2")** | **WORKING** | Real draft count (verified 7) |
| Search | UI_ONLY | **WORKING** | Filters by name |
| Header Import / From Template / Ask AI; Filters; drawer AI buttons | UI_ONLY (no-op) | NOT_IMPLEMENTED (disabled) | New Document link kept (real `/documents/new`) |
| Drawer "Recent Activity" | **UI_ONLY (fabricated "System approved … Oct 15, 2026")** | WORKING (honest) | Fabricated entry removed; shows real last-updated + current status |

### Analytics (`app/dashboard/analytics/page.tsx`)
| Feature | Status (before) | Status (now) | Notes |
|---------|-----------------|--------------|-------|
| Sprint Velocity / Project Health / Work-by-Status charts | WORKING | WORKING | Real `/api/v1/sprints`, `/analytics/projects`, `/tasks` |
| "Handoff Analysis" narrative | **UI_ONLY (fabricated "-12%", "96.6%")** | removed | — |
| KPI strip | **UI_ONLY (3.9d / 52 pts / 94% + fake deltas)** | **WORKING (derived)** | Avg Sprint Velocity, Completion Rate, Projects On Track %; Avg Cycle Time = honest "—". Verified: 2 pts / 5% / 86% |
| Pie center "65% On Track" | **UI_ONLY (hardcoded)** | **WORKING** | Real on-track % |
| Cycle Time Trend chart | **UI_ONLY (hardcoded W1–W6)** | NOT_IMPLEMENTED (honest) | "Cycle-time history not available yet" |
| Other 7 tabs | **UI_ONLY ("Data is being aggregated… Generate with Handoff")** | NOT_IMPLEMENTED (honest) | "Not available yet" |
| Header buttons + Date/Team/Compare selects | UI_ONLY (no-op) | NOT_IMPLEMENTED (disabled) | — |

**Audit E verdict:** QA/Security, Documents, and Analytics now show only real Supabase-backed data; every fabricated panel/number was replaced with a real derived value or an honest "not available yet", and every dead control is disabled. lint 0; vitest 41/41.

## Audit F — De-fake pass: Inbox / Overview / My Work (2026-06-28)

Three pages still surfaced hardcoded operational content. This pass removed **every** fabricated count, narrative, name, task ID, sprint, blocker, and activity row and replaced each with a real, organization/member-scoped query, plus realtime refresh and consistency tests.

### F1 — Inbox category counts (`app/dashboard/inbox/page.tsx`)
| Fake source removed | Real query / API that replaced it | Status |
|---------------------|-----------------------------------|--------|
| Hardcoded `categories` array (`All:24, Unread:5, Mentions:2, Approvals:1, Task Updates:8, PRs:4, …`) | Server-computed `counts` from the **same** org-scoped notifications query (recipient + not-archived) in `listNotifications` (`services/notification.service.ts`); client renders badges from `data.counts`. Grouping via shared `lib/constants/notification-categories.ts` (`categoryOf`). | WORKING |
| `ALL` / `UNREAD` / `MENTIONS` shown from different/﻿hardcoded sources | All three derive from the one `counts` object; the visible list is filtered client-side with the **same** `categoryOf` mapping → badges, counts, and rows can't contradict. | WORKING |
| List always showed every notification regardless of selected category | `visibleNotifications` filters by `activeCategory` (`all`/`unread`/category key). | WORKING |
| "Inbox Zero" shown even when a category filter was simply empty | Empty state now distinguishes true zero (`counts.all === 0` → "Inbox Zero") from an empty filter ("Nothing Here / No notifications in this category"). | WORKING |
| Fabricated "Handoff AI Summary" (hardcoded per-type narratives: "S. Chen… PAY-231", "Datadog 15% error rate", "14 PRs across 3 teams"…) | Removed. | WORKING (removed) |
| Fabricated "Related Activity" ("System linked task to epic", "M. Johnson changed status…") + non-functional quick-reply footer | Removed. | WORKING (removed) |
| Unread **badge** (bell) vs Inbox count drift | Both `NotificationBell` and Inbox read `data.counts.unread` / `data.unread` from the same endpoint. | WORKING |

### F2 — Overview Intelligence Feed + charts + Priority table (`app/dashboard/page.tsx`, `services/analytics.service.ts`)
| Fake source removed | Real query / API that replaced it | Status |
|---------------------|-----------------------------------|--------|
| Hardcoded Intelligence_Feed narrative ("Three sectors require manual override… Payments API… Mobile Sprint 14 at 110%…") | `signals[]` from `getOverview`: real counts of **open incidents, overdue tasks, blocked tasks, critical bugs, open security findings, pending approvals, projects at risk** — each with severity + source link. Truthful empty state ("No active signals…") when none. | WORKING |
| `velocityData` constant (`Sprint_10..14: 120/135/128/142/110`) | `velocity[]` = real `completed_story_points` of `status='COMPLETED'` sprints; honest empty state when no sprint completed. | WORKING |
| `workloadData` constant (`Payments 85/100 … Mobile 110/100`) — fake "Capacity_Load" | Replaced chart with **Open_Tasks_By_Project** (`workload[]`): real open-task counts grouped by project code. | WORKING |
| Priority_Overrides fake rows ("Implement 2FA flow / Sarah_J", "CVE-2024-1234 / Alex_M", "Release v2.4.0 / David_L"…) | `priorityItems[]`: real **blocked + overdue tasks** (task_key, project code, status, real assignee name) and **open incidents** (title, severity, status, real commander name). Empty state when nothing qualifies. | WORKING |
| Static overview (no live refresh) | `useTablesRealtime(['tasks','incidents','approval_requests','bugs'])` re-fetches `/api/v1/dashboard/overview`. | WORKING |

### F3 — My Work rebuild (`app/dashboard/my-work/page.tsx`, `services/my-work.service.ts` + `GET /api/v1/my-work`)
New member-scoped endpoint returns `{ tasks, kpis, blockers, upcoming, recentActivity, sprint, approvals }` — one source of truth so KPI totals and the table agree.
| Fake source removed | Real query / API that replaced it | Status |
|---------------------|-----------------------------------|--------|
| `Showing 1-5 of 14 tasks` / `1 / 3` (hardcoded, contradicted the rendered rows) | Client pagination over the filtered task array; `Showing {rangeStart}-{rangeEnd} of {filtered.length}` + `{page}/{pageCount}` all computed from the same array. | WORKING |
| KPI strip computed client-side from a separate fetch | KPIs (`active/dueToday/overdue/blocked/points/donePoints/total`) computed server-side in `getMyWork` from the member's RLS-visible task set — same set the table pages. | WORKING |
| Recent Activity (fake: "S. Chen approved your PR #4921", "M. Johnson mentioned you APX-4899"…) | Real `task_activity` rows on RLS-visible tasks (actor name + activity type + task_key + relative time); empty state otherwise. | WORKING |
| "Sprint 42: Ledger Finalization" with hardcoded `32/45`, `13` remaining, `8` at risk | Member's most-active sprint (the active sprint holding most of their open tasks) with real `planned/completed_story_points`, my-open-items, my-points; empty state when none. | WORKING |
| Fabricated AI Daily Brief ("7 active tasks", "Node.js Update blocked by Platform Eng", "Sarah approved your PR", "Sources: Jira (3), GitHub (1), Slack (2)") | **Hidden** until it can summarize authorized real data with verifiable source links (per requirement). | HIDDEN |
| Blockers (fake "APX-4899: Update Node.js · Blocked by ARC-102 · Owner D. Smith") | Real blocked tasks assigned to the member (`status='BLOCKED'`). | WORKING |
| Upcoming Deadlines (fake APX-4921/4912/4905, "Oct 25") | Real open tasks due within the next 7 days. | WORKING |
| "My Approvals · 3 Pending" (fake "Merge PR #492 / T. Vance", "RC v2.4 / Release Mgr") | Real **Pending Approvals**: `approval_requests` with `status='PENDING'` (RLS-scoped), real type/project/requester. | WORKING |
| Task detail drawer (100% fabricated — "Implement Retry Logic for Stripe Webhooks", code block, fake PR, fake AI analysis) | Minimal drawer rendering **only** the selected task's real fields (key, title, project, due, priority, type, points) + "Open in Task Board" link. | WORKING |
| Static (no live refresh) | `useTablesRealtime(['tasks','task_assignees','task_activity','notifications'])`. | WORKING |

### Tests added (`tests/integration/de-fake-pass.test.ts`, 6/6)
- **Empty workspace + cross-company isolation:** org-less user sees 0 notifications/tasks/projects; a member's notifications all carry `organization_id = ORG`.
- **Inbox Zero:** with no notifications every count (all/unread/each category) is 0 — no contradictions.
- **Count consistency:** `all == row count`, `unread == unread rows`, and category counts sum to `all`; still consistent after inserting one mention (all/unread/mentions each +1, sum invariant holds).
- **My Work pagination consistency:** the table source, the "of Z" total, and KPI `active` are one array; paging covers exactly Z rows; every visible task is org scoped.
- **Realtime:** `scripts/verify-realtime.mjs` extended — verifies dev receives a live **notification** INSERT (Inbox counts/badge/My Work) in addition to the live task event. Both PASS.

**Audit F verdict:** Inbox, Overview, and My Work now show only real, org/member-scoped Supabase data; counts are internally consistent and refresh live; the AI brief is hidden until truthful. lint 0; vitest 47/47; realtime PASS.

## Files changed this pass

- `services/member.service.ts` — added `getAssignableMembers()` (project/team-scoped, excludes suspended + Client Viewers, returns title/team/role/capacity).
- `app/api/v1/projects/[projectId]/assignable-members/route.ts` — new endpoint, gated by admin/`task:create`/`task:assign`.
- `components/tasks/create-task-modal.tsx` — new full Create Task modal with filtered assignee dropdown.
- `components/tasks/kanban-board.tsx` — replaced title-only quick-add with the modal.
- `components/tasks/task-drawer.tsx` — added status select (`task:update`), reassign select (`task:assign`), comment author display, and @mention picker.
- `services/comment.service.ts` — `listComments` now embeds author profile (full_name, job_title).
- `services/member.service.ts` — `assertAssignable()`; `services/task.service.ts` — eligibility enforced on create/update/addAssignee.
- `app/api/v1/tasks/route.ts` + `[taskId]/route.ts` — require `task:assign` when request carries an assignee.
- `components/tasks/create-task-modal.tsx` — added start date, estimated hours, story points, security classification, acceptance criteria, additional assignees.

## Tests run
- `npx vitest run` → **35/35 passed** (baseline; includes RLS isolation + role boundary).
- `npm run lint` → only 2 **pre-existing** errors in `app/signup/page.tsx` (`react-hooks/set-state-in-effect`), unrelated to this work; new files clean.
- Live browser/API: create+assign (pm@) → notify+My Work+status update (dev@) → 403 gates (dev@). All pass.

## Known issues / next
1. Add remaining Create-Task fields (epic, start date, est. hours, story points, acceptance criteria, security classification, additional assignees).
2. Fix the 2 pre-existing `signup/page.tsx` lint errors (separate from Audit A/B).
3. Re-test sign-out and org switcher in-browser.
4. Add Playwright coverage for: PM create+assign, employee My-Work visibility, eligible-dropdown filtering, cross-org 403.

---

## Completed Fixes
- **2026-06-27 — Audit C: comment edit/delete + threaded replies:** Added `updateComment`/`deleteComment` (`services/comment.service.ts`; soft-delete via existing `deleted_at`, author-checked) + `PATCH`/`DELETE /api/v1/tasks/:taskId/comments/:commentId` (require `comment:update_own`/`comment:delete_own`). Wired Edit/Delete/Reply into `task-drawer.tsx` (own-comment only; threaded replies render nested; `[deleted]`/`· edited` indicators). No migration needed (`edited_at`/`deleted_at`/`parent_comment_id` already existed). Added `tests/integration/comment-edit-delete.test.ts` (4/4 — RLS ownership). **Verified live (admin@):** edited a comment (→ "· edited", DB `edited_at`), soft-deleted it (→ "[deleted]", DB `deleted_at`), posted a threaded reply (nested, DB `parent_comment_id`). lint 0; vitest 39/39.
- **2026-06-27 — Audit A/B follow-ups (this pass):** (1) Fixed the 2 pre-existing `app/signup/page.tsx` lint errors (`react-hooks/set-state-in-effect`) by deferring the synchronous resets into the debounce callback — **`npm run lint` now 0 problems**. (2) **Epic field → WORKING:** added `listProjectEpics` + `GET /api/v1/projects/:projectId/epics` (RLS-scoped), wired an epic picker into `create-task-modal.tsx`, and seeded one epic per project (35 tasks linked). Verified live as pm@: picker showed "UPI Core Delivery"; created task persisted with `epic_id` (DB-confirmed). (3) **Sign out → WORKING:** verified redirect to `/login` and route-guard bounce afterward. vitest 35/35.
- **2026-06-27 — Audit B:** Employee assignment wired end-to-end (eligible-assignee endpoint + Create Task modal + drawer status/reassign). Verified: UPI-116 created & assigned by pm@, dev@ received `TASK_ASSIGNED`, saw it in My Work, and moved it to `IN_PROGRESS`; role/org gates enforced (dev@ 403 on assign).
- **2026-06-27 — Audit B hardening:** Backend now validates every assignment (`assertAssignable` on create/update/addAssignee — never trusts the frontend member ID), requires `task:assign` whenever an assignee is in the request, and added `data-testid` hooks. Created `docs/HANDOFF_REALTIME_DATA_FLOW.md`. Verified: Client Viewer/out-of-scope/bogus → 422, valid → 201, dev@ → 403. vitest 35/35.
- **2026-06-27 — Audit B fields + Audit C:** Added remaining create-task fields (start date, est hours, story points, security classification, acceptance criteria, additional assignees) — verified persist (UPI-122, 2 assignees). Comments show author name + job title (server-enriched) and support an @mention picker — verified pm@ comment → dev@ `TASK_MENTIONED` with task + comment deep-link IDs. vitest 35/35; lint clean (2 pre-existing signup errors remain).
