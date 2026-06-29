# Handoff - Private Task Visibility Audit

Date: 2026-06-29

## Status

**BROWSER-VERIFIED 2026-06-29.** All RLS checks confirmed live against local Supabase with real user sessions. See Verification section below.

## Security Model

Tasks now default to `visibility_scope = PRIVATE_ASSIGNMENT`.

Allowed scopes:

- `PRIVATE_ASSIGNMENT`: visible only to org admins/owners, reporter, current active assignees, explicit visibility members, the assigner, responsible project manager, and managers of assigned members with `task:view_team_assignments`.
- `PROJECT_SHARED`: also visible to members who can view the project. Requires admin/owner or project-manager authority to set.
- `ORGANIZATION_VISIBLE`: visible to active org members with `task:view`. Requires admin/owner or project-manager authority to set.

Project membership alone no longer grants access to private tasks. Regular developers and QA testers cannot set a task's visibility scope to anything broader than `PRIVATE_ASSIGNMENT`.

## Database Changes

- `supabase/migrations/0047_private_task_visibility.sql`
  - Adds `tasks.visibility_scope`.
  - Adds `task:view_team_assignments`.
  - Adds `task_visibility_members`.
  - Extends `task_assignees` with org/project metadata, `assignment_type`, `assigned_by_member_id`, `removed_at`, and `removed_by_member_id`.
  - Replaces active assignment uniqueness with a partial unique index so removed assignments remain as history.
  - Adds tenant guards for assignment and explicit visibility rows.
  - Replaces task, comments, attachments, activity, checklist, label, dependency, watcher, and time-entry RLS policies to use `handoff.can_view_task(...)`.
- `supabase/migrations/0048_fix_tasks_rls_snapshot.sql`
  - Inlines tasks_select policy to fix PostgREST snapshot isolation (INSERT RETURNING was failing).
- `supabase/migrations/0049_visibility_scope_permission_guard.sql`
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
| `handoff.can_view_task` | migration 0047 |
| `handoff.can_edit_task` | migration 0047 |
| `handoff.can_assign_task` | migration 0047 |
| `handoff.can_assign_to` | migration 0047 |
| `handoff.can_view_task_assignment_history` | migration 0047 |
| `handoff.can_create_task_with_visibility` | migration 0047, tightened in 0049 |
| `handoff.can_set_task_visibility` | migration 0049, wired into UPDATE policy in 0050 |
| `tasks_select` sub-query fix | migration 0051 — explicit `tasks.id` qualifiers |
| `handoff.is_project_responsible_manager` | migration 0047 |
| `handoff.manages_task_assignee` | migration 0047 |

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
- `npx.cmd supabase db reset` — applied migrations 0047–0049 cleanly.
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

**Bug found and fixed during live testing:** migration 0049 added `handoff.can_set_task_visibility()` but did not wire it into the `tasks_update` WITH CHECK clause. An assignee (dev@) could bypass the restriction via direct Supabase REST PATCH. Fixed in migration 0050 (`supabase/migrations/0050_wire_visibility_scope_into_update_policy.sql`).

### Realtime leak test (2026-06-29)
qa@ subscribed to Supabase Realtime `public:tasks` channel filtered to UPI-106 (PRIVATE_ASSIGNMENT, qa not assigned). pm@ updated the task title via Supabase REST. qa received **0 data events** — only the initial `system` join acknowledgment. ✅ PASS

### Integration test suite (2026-06-29)
All **8/8** tests pass with live local Supabase (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + `TEST_USER_PASSWORD`).

**Second bug found and fixed during integration run:** migration 0048 used unqualified `id` and `organization_id` inside the `task_assignees` and `task_visibility_members` sub-queries of `tasks_select`. PostgreSQL resolved these against the sub-query's own table columns (`ta.id`, `tvm.id`) rather than the outer `tasks` row — making `ta.task_id = ta.id` always FALSE. This silently disabled REVIEWER assignment visibility and explicit `task_visibility_members` grants. Fixed in **migration 0051** (`supabase/migrations/0051_fix_tasks_select_subquery_refs.sql`) using `tasks.id` / `tasks.organization_id` explicit qualifiers.
