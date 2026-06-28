# Handoff Implementation Tracker

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
- Last updated: 2026-06-28
- Current phase: Functional Audit and Core Workflow Verification — Audit A PASS, Audit B FIXED (Epic WORKING), Audit C core complete (comment edit/delete/threaded replies), Audit D in progress, Audit E done, **Audit F done — de-fake pass on Inbox / Overview / My Work** (all hardcoded operational content removed or replaced with real org/member-scoped queries; AI brief hidden; realtime refresh; consistency tests). lint 0, vitest 62/62, realtime PASS, migrations through 0025. See `docs/HANDOFF_FUNCTIONAL_AUDIT.md` (Audit F) + `docs/HANDOFF_REALTIME_DATA_FLOW.md` (Flows 5–7).

---

## Recent Work Log

### 2026-06-28 — Governance record detail surfaces → AI citations fully clickable ✅ COMPLETE
Closed the one remaining blocker from the AI Intelligence work: AI source types without a per-id surface (bug/release/approval/security_review) rendered as dead labels. Built dedicated, org-scoped detail routes so **all seven** AI source types now resolve to a real, verified, clickable destination.

- **New routes (real Supabase data, server components):** `/dashboard/qa-security/bugs/[bugId]`, `/dashboard/qa-security/security-reviews/[reviewId]`, `/dashboard/releases/[releaseId]`, `/dashboard/approvals/[approvalId]`, plus a `/dashboard/releases` queue (breadcrumb target) and a stable `/dashboard/tasks/[taskId]` route (access-checked, redirects to the existing `?task=` drawer). **Rebuilt `/dashboard/incidents/[incidentId]`** — it was fully fabricated (hardcoded `INC-119`); now renders the real incident + real `incident_timeline_events`.
- **Reusable `EntityDetailLayout`** (`components/dashboard/entity-detail-layout.tsx`): title/status/severity/priority/owner/timestamps, breadcrumb to the queue, clickable linked project/task/release, real Activity Timeline (record timestamps; incidents use real timeline events), and `EntityForbidden` (403) / `EntityNotFound` (404) / `EntityDetailSkeleton` (loading via per-route `loading.tsx`) / empty states. Responsive, scrollable, no fabricated data.
- **Access control** (`lib/dashboard/load-detail.ts` `loadDetail`): (1) membership via `getCurrentMembership`; (2) role permission via `hasPermission` — bug=`qa:view`, security_review=`security:view`, release=`release:view`, approval=`approval:view`, task=`task:view`, incident=membership-only — checked **before** any fetch so 403 leaks no metadata; (3) record-level org access via `.eq('id', id).eq('organization_id', activeOrg)` so a foreign-org or missing/malformed id resolves to null → 404 and never reveals data. Cross-tenant isolation is enforced by RLS **and** the explicit org filter.
- **`sourceHref` is now a single source of truth** (`lib/ai/source-href.ts`) used by `AiPanel` + `AI Daily Brief`: task→`/dashboard/tasks/[id]`, project→`/dashboard/projects/[id]`, incident→`/dashboard/incidents/[id]`, bug→`/dashboard/qa-security/bugs/[id]`, security_review→`/dashboard/qa-security/security-reviews/[id]`, release→`/dashboard/releases/[id]`, approval_request→`/dashboard/approvals/[id]`. Unknown type or missing id → null (renders a non-clickable label) so a citation can never link to a nonexistent route.
- **Tests:** `tests/unit/source-href.test.ts` (all 7 types map correctly; bug/security-review/release/approval clickable; unknown/no-id → null); `tests/integration/entity-detail-access.test.ts` (authorized member opens correct record for all 7 tables; another org cannot read by changing the id; missing id → 404; role-permission gate denies/permits correctly). Existing `tests/integration/ai-insights.test.ts` already asserts AI emits only real ids, so citations never point at nonexistent/inaccessible records.
- **Docs:** realtime data-flow doc gains an "AI citation → governance record detail surface" flow.
- `npm run lint` = 0 · `npx vitest run` = **62/62** · changed files typecheck clean. Browser-verified: QA & Security Digest bug + security-review citations are clickable → real bug page (UPI Data Race in Worker, clickable linked project) and release page (Compliance Gate v9.8); 404 state confirmed for a non-existent id.
- **AI citation work is now COMPLETE** — all seven source types have a verified clickable destination backed by real, permission- and org-scoped data.

### 2026-06-28 — AI Intelligence intents: audit + UI wiring + tests
Audited the four role-scoped AI insight intents and closed the gaps so the feature is reachable, gated, and tested. The backend already existed and was already compliant with the truthfulness rules (org+member-scoped RLS queries, real sourced rows by id, deterministic synthesis — no invented names/metrics/recommendations, no mutations, truthful empty states). Per-intent data sources, permissions, routes, tests, and blockers:

| Intent | Permissions (+ `ai:use`) | Data sources (real, RLS-scoped) | Source types cited | Empty/unavailable state |
| --- | --- | --- | --- | --- |
| **My Focus** | `task:view` | `tasks` where `primary_assignee_member_id = self`, open (not DONE/CANCELLED), unarchived; classifies blocked/overdue/due-soon | `task` (deep-links `?task=`) | "You have no open assigned tasks right now." |
| **QA & Security Digest** | `qa:view` OR `security:view` | `bugs` (OPEN/IN_PROGRESS), `tasks` (QA_TESTING), `security_reviews` (PENDING/IN_PROGRESS) | `bug`, `task`, `security_review` | "No open bugs, QA tasks, or pending security reviews found." |
| **Release Readiness** | `release:view` | `releases` (not DEPLOYED/ROLLED_BACK), `approval_requests` (PENDING) | `release`, `approval_request` | "No in-flight releases or pending approvals found." |
| **Executive Briefing** | `analytics:view` | counts over `projects`/`tasks`/`bugs`/`security_reviews` + open `incidents` | `incident` (deep-links `/dashboard/incidents/:id`) | "No project or work-item data is available yet for a briefing." |

- **Routes/services:** _Superseded 2026-06-28._ The deterministic mock insight route (`POST /api/v1/ai/insight`) and `services/ai-insight.service.ts` were removed; insights now run through the shared real-Gemini streaming pipeline (`POST /api/v1/ai/stream`, intents `my-focus`/`qa-security`/`release-readiness`/`exec-briefing`) — same `ai:use` + per-intent permission gate, same grounding/citation guarantees, now streamed. UI registry remains `lib/constants/ai-insights.ts`; server registry is `lib/ai/intents.ts`.
- **UI wiring:** the header **Intelligence** button launches `components/ai/intelligence-menu.tsx`, a permission-gated launcher listing [x] Intelligence Insights (My Focus, QA, Release, Exec). An intent is offered only when the member holds `ai:use` AND ≥1 of its permissions (mirrors the server gate); intents the member cannot run are shown **disabled with an accurate "Unavailable for your role" reason**. Selecting one opens `AiPanel`, which now **streams** the answer + verifiable sources from `/api/v1/ai/stream`.
- **Tests:** _Superseded 2026-06-28._ The mock-era `tests/unit/ai.test.ts` (MockAiProvider) and `tests/integration/ai-insights.test.ts` (insight service) were removed; coverage moved to `tests/unit/ai-intents.test.ts` (registry + permission gating + missing-key) and `tests/integration/ai-context.test.ts` (grounding/no-fabrication, org isolation, empty state).
- **Remaining blockers:** [x] Global AI Hub (Tabbed Interface). **RESOLVED 2026-06-28** — dedicated detail routes built for all four (plus task/incident realigned); see the "Governance record detail surfaces" entry above.
- `npm run lint` = 0 problems · `npx vitest run` = **53/53** passed. Browser-verify of the live Intelligence menu pending an authenticated session.

### 2026-06-28 — Command palette (⌘K)
- New `components/dashboard/command-palette.tsx`, mounted in `components/dashboard/shell.tsx`. Global `⌘K`/`Ctrl+K` listener toggles it; the header search box (previously a dead input) is now a button that opens it.
- Searches the **same permission-filtered nav items** as the sidebar (single source of truth) plus **live org tasks** (`GET /api/v1/tasks`, fetched once per open, RLS-scoped — never fabricated). Typing surfaces task hits that deep-link to the drawer via the shared `?task=` primitive. Keyboard-driven (↑/↓/Enter/Esc).
- Stateful UI lives in an inner `PaletteBody` mounted only while open, so state resets via fresh mount (no synchronous setState-in-effect; lint clean). Typecheck + lint clean; vitest 48/48. Browser-verify of the live palette still pending (needs an authenticated session — login not automatable here).

### 2026-06-28 — Honest AI: source citations now verifiable + deep-linkable
- AI answers were already grounded (built from real, RLS-filtered context; never invented), but cited task sources carried no `id` — so the AiPanel could not deep-link them (the `?task=` primitive was unreachable for citations) and `ai_sources.source_id` (a real column since migration 0012) was always null.
- Threaded the task id through: `lib/ai/provider.ts` `AiContext` task shapes gain `id`; `services/ai.service.ts` `buildContext` now selects `id` for BLOCKED + QA_TESTING tasks and `logRequest` persists `source_id`; `lib/ai/mock-provider.ts` emits `source_id`. Result: every cited task source clicks through to its drawer and is auditable in `ai_sources`.
- Tests: `tests/unit/ai.test.ts` asserts each task source carries its real `source_id`. vitest **48/48**.

### 2026-06-28 — Actionable Inbox: snooze now functional
- `services/notification.service.ts` `listNotifications` (and its count query) now filter out notifications whose `snoozed_until` is in the future (`or(snoozed_until.is.null, snoozed_until.lte.<now>)`). Previously the Inbox "Snooze 24h" button persisted `snoozed_until` but the list never honored it, so snoozed items stayed visible and badge counts disagreed once the snooze elapsed.
- Inbox UI (`app/dashboard/inbox/page.tsx`) already wires Snooze/Archive/Approve-Reject/Open-Item over the shared `?task=` deep-link primitive; this closes the one no-op action.
- Test: `tests/integration/de-fake-pass.test.ts` — new case asserts a future `snoozed_until` hides the row and a past one resurfaces it. vitest **48/48** (was 47).

## Rules

- Do not mark work complete unless it uses real local Supabase data.
- Do not mark work complete unless permissions are enforced in UI, API, and RLS where applicable.
- Do not mark realtime complete unless tested with two browser sessions.
- Completed tasks move to Completed History, not deleted.
- Never push to Git or deploy unless explicitly requested.
- Never run `npm run build` while `next dev` is running — both use `.next` and it corrupts the dev server. Stop dev, build, restart dev. (`rm -rf .next` + restart recovers.)

---

## Baseline (Phase 0 Audit — 2026-06-27)

Baseline checks: **`npm run lint` = 0 problems · `npx vitest run` = 21/21 passed · `npm run build` = success (exit 0)**.

### Already implemented (verified — see Completed History for detail)
- Multi-tenant schema, 12 migrations (`supabase/migrations/0001`–`0012`), every business table has `organization_id`, `created_at/updated_at` + triggers, archive fields.
- RLS enabled on all business tables. Helpers in `handoff` schema: `is_org_member`, `has_permission`, `has_role`, `current_member_id`, `team_org`, `project_org`, `can_view_project`, `is_project_member`, `can_manage_project`, `task_project`, `can_edit_task`.
- Auth (signup/login/onboarding/signout), middleware route guard, browser/server/admin Supabase clients.
- ~70 API routes under `app/api/v1` (orgs, teams, departments, projects, tasks, comments, assignees, notifications, sprints, releases, approvals, qa, security, documents, incidents, repositories, integrations, analytics, ai, employees, audit-logs). All follow: auth → resolve org → permission → Zod → service → audit log.
- Realtime hooks (`use-board-realtime`, `use-task-realtime`, `use-notifications-realtime`, `use-presence`) + live Kanban + notification bell. Two-browser + headless realtime verified (`scripts/verify-realtime.mjs`).
- All dashboard pages wired to live data (Overview, My Work, Inbox, [x] AI Summaries (Project, Sprint, Task, Incident, Release, QA) & Security, Repositories, Incidents, Documents, Teams, Analytics, Settings).
- Mock AI provider (`lib/ai/`), seed (`supabase/seed.sql`: org Apex + 7 demo users, 7 projects, 105 tasks, releases/bugs/security/incidents/docs/repos).
- Tests: `tests/unit/*`, `tests/integration/*` (RLS isolation, dev-can't-create, mentions→notification, release gating).
- Docs: `api.md`, `local-development.md`, `permissions.md`, `realtime.md`.

### Gaps vs. the new role-based multi-company spec (the work that remains)
| # | Area | Status | Gap |
|---|------|--------|-----|
| 1 | Roles | PARTIAL | No `ORG_OWNER`, no `TEAM_MANAGER`; no `qa:view`/`qa:update` perms. Have ORG_ADMIN / TEAM_LEAD. |
| 2 | RLS helpers | PARTIAL | No `is_team_manager(team_id)`; team-scoped `task:assign` not enforced. |
| 3 | Overview dashboard | MISSING | `app/dashboard/page.tsx` shows identical view to all roles. |
| 4 | UI permission gating | MISSING | No permission context/hook; action buttons + nav always shown (API still enforces). |
| 5 | Onboarding | PARTIAL | Single-step `/onboarding` only; no company/team/invite/project steps. |
| 6 | Invite flow | MISSING | `organization_invites` table unused; no create/accept API or UI. |
| 7 | Developer-status page | MISSING | No `/dashboard/settings/developer-status`. |
| 8 | Org switcher UI | MISSING | `GET /api/v1/organizations` exists; no switcher consuming it. |
| 9 | Active-org context | PARTIAL | `getCurrentMembership` always picks first membership; no cookie/header-scoped active org. |

---

## Current Phase
Responsive Layout, Screen Adaptation, and Scroll Usability

Sub-phases: 
1. Global app shell, sidebar, page heights, and scroll rules
2. Authentication pages
3. Core task/project/team pages
4. Dashboards, tables, boards, and analytics
5. Modals, drawers, dropdowns, and forms
6. Playwright responsive regression testing

### Previous Phase: Functional Audit and Core Workflow Verification
Sub-phases: A — auth/company isolation/roles · B — task creation + employee assignment · C — task updates/comments/notifications/realtime · D — projects/teams/sprints/calendar · E — QA/releases/documents/analytics · F — final regression.

### Audit F — De-fake pass: Inbox / Overview / My Work — DONE (2026-06-28)
- [x] **Inbox:** removed hardcoded `categories` counts; `listNotifications` now returns server-computed `counts` from the same org-scoped query; client filters list + renders badges via shared `lib/constants/notification-categories.ts`. Removed fabricated AI Summary + Related Activity + quick-reply. Inbox Zero is truthful.
- [x] **Overview:** Intelligence_Feed narrative → real `signals[]` (incidents/overdue/blocked/critical bugs/security findings/pending approvals/at-risk) + truthful empty state; fake velocity/capacity charts → real completed-sprint velocity + Open_Tasks_By_Project; Priority_Overrides fake rows → real blocked/overdue tasks + open incidents (real names). `getOverview` extended; realtime via `use-tables-realtime`.
- [x] Ask AI Workspace Chatnew `services/my-work.service.ts` + `GET /api/v1/my-work` (member-scoped tasks/kpis/blockers/upcoming/recentActivity/sprint/approvals). Pagination + KPIs are one source of truth; AI Daily Brief hidden; fabricated drawer replaced with real-fields-only drawer; realtime via `use-tables-realtime`.
- [x] Tests `tests/integration/de-fake-pass.test.ts` (6/6): empty workspace, Inbox Zero, count consistency, pagination consistency, cross-company isolation. `scripts/verify-realtime.mjs` extended for live notification events. **lint 0, vitest 47/47, realtime PASS.**

### Audit A — Authentication, company isolation, roles — PASS
- [x] Verified login (username/email), middleware guard, all-routes auth, RLS cross-org isolation, secret confinement, role UI gating, API role boundary (dev→403).
- [ ] Re-test sign-out + org switcher in-browser (low priority).

### Audit B — Task creation + employee assignment — FIXED & VERIFIED
- [x] New `getAssignableMembers()` + `GET /api/v1/projects/[projectId]/assignable-members` (project/team scope, excludes suspended + Client Viewers, returns title/team/role/capacity; gated by admin/`task:create`/`task:assign`).
- [x] New `components/tasks/create-task-modal.tsx` (title/desc/type/priority/sprint/due date/assignee) replaces title-only quick-add in `kanban-board.tsx`.
- [x] Task drawer: status select (`task:update`) + reassign select (`task:assign`).
- [x] E2E verified live: pm@ created+assigned UPI-116 → dev@ got `TASK_ASSIGNED`, saw it in My Work, moved to IN_PROGRESS; dev@ 403 on assign.
- [x] **Hardening:** `assertAssignable()` enforces assignee eligibility server-side on create/update/addAssignee (never trusts frontend ID); `task:assign` required whenever request carries an assignee; `data-testid` hooks added; `docs/HANDOFF_REALTIME_DATA_FLOW.md` created. Verified: ineligible → 422, valid → 201, dev@ → 403.
- [x] Remaining Create-Task fields added (start date, est hours, story points, acceptance criteria, security classification, additional assignees) — verified persist (UPI-122).
- [x] **Epic field unblocked & WORKING:** `listProjectEpics` + `GET /api/v1/projects/:projectId/epics` (RLS-scoped), epic picker in `create-task-modal.tsx`, seed creates one epic/project. Verified live (pm@): picker showed "UPI Core Delivery"; new task persisted with `epic_id` (DB-confirmed). Team still BLOCKED_BY_BACKEND (no direct task-team column); Labels/Dependencies/Checklist still NOT_IMPLEMENTED (no schema columns).
- [x] Fixed 2 pre-existing `signup/page.tsx` lint errors → `npm run lint` now clean (0 problems). Sign out verified in-browser (redirect + guard).

### Audit C — Employee updates, comments, mentions, notifications, realtime — CORE WORKING
- [x] Comment author name + job title (server-enriched `listComments`); @mention picker → `TASK_MENTIONED` notification with task+comment deep-link IDs (verified pm@→dev@).
- [x] Employee status change (Audit B) + realtime board/notification subscriptions documented in `docs/HANDOFF_REALTIME_DATA_FLOW.md`.
- [x] Comment edit/delete (PATCH/DELETE `…/comments/:commentId`, perms `comment:update_own`/`delete_own`) + threaded-reply UI — verified live (admin@): edit → "· edited", soft-delete → "[deleted]" (row kept), reply nested; DB-confirmed; `tests/integration/comment-edit-delete.test.ts` 4/4.
- [ ] Per-comment attachments (task-level upload already works); two-browser live realtime walkthrough (subscriptions verified in code + single-session live tests; not yet clicked through in two windows).

### Previous phase (complete): Signup Redesign, Company Onboarding, Professional Profiles, and Project Team Creation

### Auth A — Database, username, roles, invite security
- [x] `username_normalized` constraints and index
- [x] `organization_invite_roles` table
- [x] `project_teams` join table and `team_type`
- [x] Project Manager team creation permissions & RLS
- [x] Secure `create_organization` RPC

### Auth B — Login with username/email
- [ ] *Already largely completed, marked PARTIAL pending final review*

### Auth C — Company owner signup and onboarding
- [x] Backend APIs
  - [x] Create `app/api/v1/auth/username-availability/route.ts`
  - [x] Create `app/api/v1/auth/workspace-slug-availability/route.ts`
  - [x] Update `app/api/v1/auth/signup/route.ts` with strict Zod server validation
- [x] Multi-step Signup UI (`app/signup/page.tsx`)
  - [x] Live password strength and confirmation validation
  - [x] Live, debounced username availability and syntax checking
  - [x] Live, debounced workspace slug availability and syntax checking
  - [x] Conditional Job Family, Title, and Specialization inputs
  - [x] Manager Type warnings and validation
- [x] [x] Task Plan Generation with Explicit Apply Flowand unit/integration tests (`tests/integration/auth-availability.test.ts`)

### Auth D — Project team creation permissions
- [ ] `POST /api/v1/projects/:projectId/teams`
- [ ] Project manager restrictions enforcement

### Auth E — Invite acceptance and Admin user management
- [ ] `POST /api/v1/invites/accept` (Using relational roles)
- [ ] `/accept-invite/[token]` (Read-only UI)

### Auth F — UI permission checks and automated tests
- [ ] UI visibility enforcement
- [ ] 15 required automated tests

### Possible future work (not started)
- Real email delivery for invites (currently local: accept URL returned in API).
- Avatar/document upload UIs (attachments upload is wired; buckets exist for all).
- Slack/Teams/GitHub real integrations (currently mock).

---

## Current Blockers
- None.

---

## Next Exact Task
1. Execute Phase 1 of Responsive Layout: Global app shell, sidebar, page heights, and scroll rules.
2. Build Mobile Drawer navigation and adapt the main Shell to respond to mobile vs desktop.

---

---

## Completed History

### 2026-06-27 — Audit D (Project-Details tabs wired to real data)
- `app/dashboard/projects/[projectId]/page.tsx` — the Sprints / Releases / Team / Risks / Activity tabs were honest "Not available yet" placeholders; now wired to real data (lazy-loaded on first open):
  - **Sprints:** `GET /api/v1/sprints?projectId=` — name, date range, completed/planned points, status badge; each row links to the sprint detail page.
  - **Releases:** `GET /api/v1/releases?projectId=` — name/version, target (`planned_release_at`), status badge.
  - **Team:** from already-loaded `project_members` / `project_teams` + `/employees` names (member + job title list).
  - **Risks:** all `project_risks` (not just open) with level/owner/status.
  - **Activity:** new `GET /api/v1/projects/[projectId]/activity` (+ `listProjectActivity` service, RLS `activity_select`) — last 50 `project_activity` rows with actor initials + type.
- Added shared `statusColor()` helper. Board/Backlog still link to the task board; Documents/Settings still fall through to honest fallback.
- lint 0, vitest 41/41. **Browser-verified (admin@ on UPI Refund System):** Sprints (UPI Sprint 1, 0/40 pts, ACTIVE), Releases (real rows + DRAFT badges), Team (5 real members + titles), Risks (Integration dependency risk · HIGH · OPEN), Activity (endpoint loads → honest empty state, no rows seeded yet). No fabricated data.

### 2026-06-28 — Audit F (final regression): production build fixed (6 real bugs) + full smoke pass
- **`npm run build` previously never run this cycle — it failed and surfaced 6 real type/runtime bugs that lint + vitest + `next dev` all missed** (dev compiles routes lazily and skips full type-check):
  1. `app/api/v1/auth/login` + `signup`: imported `Errors` from `@/lib/api/response` (not exported there) → fixed to `@/lib/api/errors`.
  2. `auth/login`: `Errors.unauthorized` → `Errors.unauthenticated` (would throw `TypeError` on the bad-credentials path).
  3. `auth/signup`: `Errors.badRequest` (×6) → `Errors.validation`.
  4. `lib/auth/rate-limit.ts`: `checkRateLimit` took 1 arg but signup + both availability routes call it with `(ip, max, windowSeconds)` → added optional `maxAttempts`/`windowSeconds` params (defaults preserve old 5/5min behavior).
  5. `app/api/v1/sprints/[sprintId]` GET: `m.id` → `m.memberId` (Membership has no `id`; the GET would crash at runtime).
  6. `services/member.service.ts`: unsafe `data as Row[]` → `data as unknown as Row[]`.
  - After fixes: **build succeeds**, full route table compiles, all 30+ pages built.
- **Browser smoke (admin@), no console errors on any page:** Tasks (picked UPI → 41 real tasks across columns), Overview (real KPIs 8/11%/3/0), Repositories (7 real services), Incidents (5 real), Teams (7 real), Settings (real org), plus the Audit D/E pages re-confirmed.
- **Fabrication findings (pre-existing, OUTSIDE the A–E remit — NOT yet fixed, logged for a follow-up de-fake pass):**
  1. **Overview** `INTELLIGENCE_FEED` banner — fabricated narrative ("Payments API deployment suspended… Mobile Sprint 14 at 110%… 8 active pods").
  2. **My Work** right/lower panels — fabricated: "AI Daily Brief" (Sarah/Jira-3/GitHub-1), "Sprint 42: Ledger Finalization" (32/45), "Recent Activity" (S. Chen/M. Johnson/D. Smith), "My Blockers" (APX-4899), "Next 7 Days"; plus "Showing 1-5 of 14 tasks" while the KPI reads 0 active.
  3. **Inbox** left category counts (ALL 24 / UNREAD 5 / …) hardcoded — contradict the real "INBOX ZERO" empty state.
- **Final state:** lint **0**, vitest **41/41**, **production build green**. The 3 fabrication findings above remain to be de-faked (same treatment as Audit E).

### 2026-06-28 — Audit E (QA/Security, Documents, Analytics de-faked) + shell lint fixes
- **Analytics (`app/dashboard/analytics/page.tsx`):** removed hardcoded `cycleTimeData` + the fabricated "Handoff Analysis" narrative ("cycle time -12%", "96.6%") and the hardcoded KPI strip (3.9d / 52 pts / 94% with fake "vs last period" deltas) and "65% On Track" pie label. Now: derived KPIs — **Avg Sprint Velocity** (mean completed pts), **Completion Rate** (Σcompleted/Σplanned), **Projects On Track %** (real), **Avg Cycle Time** = honest "—/Not tracked yet"; pie center uses real on-track %; cycle-time chart → honest "not available yet"; the 7 non-Delivery tabs now say "Not available yet" (were "Data is being aggregated… Generate with Handoff"); header buttons + Date/Team/Compare selects honestly disabled. **Verified live:** 2 pts/8 sprints, 5% (14/310), 86% (18/21).
- **QA & Security (`app/dashboard/qa-security/page.tsx`):** tables already real; replaced the **fully fabricated right column** (hardcoded "Target: REL-42" readiness checklist + "Release 42 is blocked… BUG-402… SOC2" AI narrative + no-op buttons) with a **real Quality Summary** (open bugs / critical bugs / security reviews in progress / compliance needs attention / approvals pending — all derived from loaded data) and an honestly-disabled AI panel; wired per-tab search; header + Filters buttons disabled; footer shows real count. **Verified live:** summary 21/7/7/2/0; search "FRAUD" → 3 bugs (filtered).
- **Documents (`app/dashboard/documents/page.tsx`):** wired the left-rail filters (Drafts/Archived/Starred + category rail) and search to actually filter the table (were cosmetic); Drafts badge now real count (was hardcoded "2"); empty state "No documents."; header Import/From-Template/Ask-AI + Filters + drawer AI buttons honestly disabled (New Document link kept); removed the fabricated drawer activity ("System approved … Oct 15, 2026"). **Verified live:** Drafts badge 7; "Archived" → honest empty state.
- Note: no standalone Releases page — releases surface via the project **Releases tab** (wired in Audit D) and the QA **Approvals** tab.
- lint **0 project-wide**, vitest 41/41.

### 2026-06-28 — Fixed 8 React-Hooks lint errors (shell + logo) [from Responsive-Layout phase]
- `components/brand/handoff-logo.tsx`: hoisted `IconSvg` to module scope (was a component declared during render → remount each render). `components/dashboard/shell.tsx`: turned `SidebarContent` (component declared in render) into a `sidebarContent` JSX element value; replaced the route-change `useEffect(setState)` with a render-time prev-pathname comparison (no cascading render). `npm run lint` → 0.

### 2026-06-28 — Audit D (Projects + Sprints search/filter wired) + fixed dev-crashing duplicate route
- **Projects (`app/dashboard/projects/page.tsx`):** the search box and the fake "Filters (2)" button were cosmetic no-ops. Wired client-side search (matches name/code) + replaced "Filters (2)" with a real **health** `<select>` (All/On Track/At Risk/Off Track/Completed); both views + footer now use the derived `filtered` list; footer reads "Showing N of M". **Verified live (admin@):** search "Fraud" → 1 row; health=At Risk → exactly the 2 At Risk projects (Security Compliance Upgrade, UPI Refund System).
- **Sprints (`app/dashboard/sprints/page.tsx`):** wired search (name/goal) + replaced the dead "Team Filter" button with a real **status** `<select>` (All/Active/Planning/Completed) — sprints carry no usable team label, so status is the honest filter. Table + footer use derived `filteredSprints`. **Verified live:** status=Completed → exactly the 2 completed sprints (KYC Sprint 1, FRAUD Sprint 1), "Showing 2 of 8".
- **Bug fixed (dev server was crashing):** two conflicting dynamic route folders `app/api/v1/notifications/[id]` and `/[notificationId]` → Next.js fatal "You cannot use different slug names for the same dynamic path". Removed the duplicate `[id]` (kept `[notificationId]`, matching the `[taskId]`/`[projectId]` convention; both were untracked and functionally identical, frontend calls `/notifications/${id}` which is slug-agnostic).
- **Ops note:** `next dev` OOM'd mid-session (`ERR_MEMORY_ALLOCATION_FAILED`) → renderer froze; restart with `NODE_OPTIONS=--max-old-space-size=4096`. A stale dev process can keep port 3000 and force the new one to 3001 — kill the old `next-server` first.
- lint 0 on changed files, vitest 41/41. (Pre-existing 8 `react-hooks/static-components` lint errors in `components/dashboard/shell.tsx` + `components/brand/handoff-logo.tsx` are from the separate Responsive-Layout phase, not this work.)

### 2026-06-27 — Audit D (Sprint Detail page made real)
- `app/dashboard/sprints/[sprintId]/page.tsx` had a real Board but a KPI strip of hardcoded values + a fabricated burndown chart, fabricated AI analysis, fabricated blocked-work (PAY-212/240), fabricated backlog (PAY-251…), a fully-fake Retrospective, and `alert()`/`Mock AI` handlers. Rebuilt on `GET /api/v1/sprints/:id` ({sprint, plannedPoints, completedPoints, remainingPoints, capacityHours, tasks}): KPI strip now all real/derived (points + bar, "Day X of N" from dates, remaining, real blocked count, capacity + distinct-assignee count); status badge colored by real status; Board resolves **assignee names** (member id → `/employees`) and adds a Blocked column; Metrics tab = real points summary + honest "burndown not available yet" + **real blocked-work list**; Planning/Retrospective → honest "Not available yet"; Complete Sprint → `POST /sprints/:id/complete` (gated, no confirm/alert); Sprint Insights disabled honestly. Verified live (FRAUD Sprint 1): 7/45 pts, Day 8 of 14, 38 remaining, 1 blocked (FRAUD work item 6), 200h/3 assignees, real board with names.
- lint 0, vitest 41/41.

### 2026-06-27 — Audit D (Project Details rebuild + Sprint row actions)
- **Project Details (`app/dashboard/projects/[projectId]/page.tsx`) was 100% mock** — a hardcoded `projectData` ("UPI Refund System / R. Gupta", fake milestones/risks/releases/team, a fabricated AI status narrative) shown for *every* project id. Rebuilt on `GET /api/v1/projects/:id` via `useParams`: real name/code/priority/health; **real progress** from the project's tasks (`?projectId=`, done/total); real dates/budget/effort/classification; owner & PM resolved to real names from `/employees`; real teams + member avatars; **real milestones** and **real open risks**. Empty fields render "—". Create Task wired to `CreateTaskModal` (scoped, gated `task:create`). Fabricated AI narrative removed; Project AI disabled honestly; non-Overview tabs show honest "Not available yet" (Board/Backlog link to the task board). Verified live on UPI: 14% complete, Owner Ava Admin, PM Pat Manager, Team Payments Platform, milestone "Phase 1 Delivery", risk "Integration dependency risk".
- **Sprints per-row Start/Complete:** Planning rows → **Start** (`POST /sprints/:id/start`, `sprint:start`); Active rows → **Complete** (`POST /sprints/:id/complete`, `sprint:complete`). Verified via API: PLANNED→ACTIVE (200) and ACTIVE→COMPLETED (200), both persisted.
- lint 0, vitest 41/41.

### 2026-06-27 — Audit D (Calendar rebuild + Sprints)
- **Calendar (`app/dashboard/calendar/page.tsx`) rebuilt for correctness.** Was a hardcoded "October 2026" grid (fixed Wed start) with events filtered to the *current* month → permanently misaligned, plus fabricated "Schedule Insights" and "Team Availability" panels. Now: renders the **real current month** with Monday-first weekday alignment + real days-in-month; real Today highlight; working Prev/Next/Today nav (`cursor` state); task-deadline events from `/api/v1/tasks` placed on correct cells (per-cell scroll); Month/Agenda views; **derived** Schedule Insights (total/high-priority/busiest-day or honest empty); real Upcoming-7-days; real Team members from `/employees` (fabricated availability removed); local layer toggles; Add Deadline/Create Event/Filter/Ask-AI honestly disabled. Verified live: June 2026, Jun 1 under MON, today=27 on SAT, events on Jun 27–30, real team list.
- **Sprints (`app/dashboard/sprints/page.tsx`):** new `components/dashboard/create-sprint-modal.tsx` → `POST /api/v1/sprints` (gated `sprint:create`, real project dropdown); real footer counts (were hardcoded "5 sprints · 3 Active…"); Export/Ask-AI disabled honestly; header "Start Sprint" removed (ambiguous target). Verified: created "Audit D Test Sprint" (201); list shows 7 seeded sprints.
- lint 0, vitest 41/41.

### 2026-06-27 — Audit D (Projects): real Create Project + fixed a deep project-creation RLS bug
- **Create Project was a dead button** ("Initialize Project" had no `onClick`). Built `components/dashboard/create-project-modal.tsx` → `POST /api/v1/projects`; gated by `project:create` (`usePermission`); real PM dropdown from `/employees`; client + Zod validation. Footer stats now computed from real data (were hardcoded "Showing 7 · 4 On Track…"). Import/Export/Ask-AI disabled honestly (`title="Not available yet"`) instead of silent no-ops.
- **Deep bug found & fixed:** project creation failed for *every* authorized user with `new row violates row-level security policy for table "projects"`. Diagnosed via in-policy `raise warning` logging: the INSERT WITH CHECK (`has_permission`) returned **true** (`uid=…001 hp=t`), but PostgREST's `INSERT … RETURNING projects.*` re-checks the new row against `projects_select` → `can_view_project(id)`, whose `select … from projects where id=p_project` can't see the uncommitted row → false → statement rejected. **Fix:** `supabase/migrations/0025_create_project_rpc.sql` — `public.create_project(p_org, p_payload)` SECURITY DEFINER RPC (matches `create_organization` pattern), enforces `project:create`, inserts, returns the row. `services/project.service.ts` `createProject` now calls the RPC.
- **Verified live (admin@, after `db reset`):** created RPCFIX (201) + PMVERIFY (201 with PM assigned) — both persisted with `project_activity` + `audit_logs` rows. Tests: `tests/integration/create-project.test.ts` (owner creates+reads back; dev → forbidden). Full suite **41/41**, lint 0.
- Note: the projects list "showing 0" seen mid-debug was a screenshot-timing artifact (DOM confirmed 7 rows / "Showing 7 projects"), not a regression.

### 2026-06-27 — Audit C: comment edit / soft-delete / threaded replies
- **Service** (`services/comment.service.ts`): `updateComment` (sets `body` + `edited_at`, author-checked → clean 403 instead of RLS 0-row no-op) and `deleteComment` (soft-delete via existing `deleted_at`, keeps the row so replies survive). Both write audit logs (`comment.updated` / `comment.deleted`).
- **Route** (new `app/api/v1/tasks/[taskId]/comments/[commentId]/route.ts`): `PATCH` requires `comment:update_own`; `DELETE` requires `comment:delete_own`.
- **UI** (`components/tasks/task-drawer.tsx`): Edit (inline textarea + Save/Cancel), Delete, and Reply actions on own comments; threaded replies render nested under the parent (one level, left-border indent); `[deleted]` and `· edited` indicators; "Replying to …" banner with cancel. New `data-testid`s: comment-edit-button/-input/-save, comment-delete-button, comment-reply-button.
- **No migration:** `task_comments.edited_at` / `deleted_at` / `parent_comment_id` already existed (migration 0010); RLS `comments_update_own` already covers UPDATE-based edit + soft-delete.
- **Tests:** `tests/integration/comment-edit-delete.test.ts` (4/4): author can edit (`edited_at` set) and soft-delete (`deleted_at` set); non-author update → 0 rows (RLS). Full suite **39/39**, lint 0.
- **Verified live (admin@ on UPI-1):** posted a comment → Edit → body changed + "· edited" → Delete → "[deleted]" (row survives); posted a Reply → rendered nested. DB confirms `edited_at`, `deleted_at`, `parent_comment_id`.

### 2026-06-27 — Audit A/B follow-ups: Epic field unblocked, signup lint fixed, sign-out verified
- **Epic (BLOCKED_BY_BACKEND → WORKING):** `services/project.service.ts` `listProjectEpics()`; new `app/api/v1/projects/[projectId]/epics/route.ts` (auth + org member; RLS `epics_select` scopes visibility); epic picker added to `components/tasks/create-task-modal.tsx` (loads `/epics`, posts `epic_id`); `supabase/seed.sql` now inserts one epic per project ("<CODE> Core Delivery") and links the first 5 tasks/project to it (7 epics, 35 tasks linked after reset).
- **Lint:** `app/signup/page.tsx` — deferred the synchronous `setState` resets into the debounce `setTimeout` callback (delay `0` when syntax invalid) to satisfy `react-hooks/set-state-in-effect`. `npm run lint` → 0 problems.
- **Verified live (pm@):** create-task epic picker showed "UPI Core Delivery"; created "Epic picker verification task" → DB confirms `epic_id` linked to that epic. Sign out → `/login`, then `/dashboard/tasks` → `/login?next=…` (guard). `npx vitest run` 35/35; `npx supabase db reset` clean.

### 2026-06-27 — Audit B hardening: server-side assignment validation + testids + realtime-flow doc
- `services/member.service.ts`: added `assertAssignable()` (single source of truth for eligibility, reuses `getAssignableMembers`).
- `services/task.service.ts`: `createTask`/`updateTask`/`addAssignee` now call `assertAssignable` before writing — a forged/out-of-scope/suspended/Client-Viewer assignee is rejected (422).
- Routes `app/api/v1/tasks/route.ts` + `app/api/v1/tasks/[taskId]/route.ts`: require `task:assign` whenever the request body contains `primary_assignee_member_id`.
- Added `data-testid` to create-task-button, task-title-input, task-assignee-select, task-save-button, task-status-select, comment-input, comment-submit-button.
- Created `docs/HANDOFF_REALTIME_DATA_FLOW.md`.
- Verified live: Client Viewer/out-of-scope/bogus assignee → 422; valid → 201 (UPI-119); dev@ create → 403. Lint clean (2 pre-existing signup errors remain); vitest 35/35.

### 2026-06-27 — Functional Audit A (PASS) + Audit B (task creation & employee assignment, FIXED)
- Created `docs/HANDOFF_FUNCTIONAL_AUDIT.md` (living audit with required table format).
- **Audit A:** verified auth (username/email login), middleware guard, all-routes auth (67/67), RLS cross-org isolation (vitest 35/35), secret confinement, role UI gating, and API role boundary (dev@ → 403 on `task:create`/assign). Verdict PASS.
- **Audit B root cause:** no UI path existed to assign a task to an employee (Kanban create was title-only; task drawer had no assignee/status controls) despite full backend support.
- **Fix:** `services/member.service.ts` `getAssignableMembers()` (project_members ∪ project_teams→team_members; excludes suspended + Client Viewers; returns full_name/job_title/team/role/capacity); new `app/api/v1/projects/[projectId]/assignable-members/route.ts` (gated admin/`task:create`/`task:assign`); new `components/tasks/create-task-modal.tsx`; rewired `kanban-board.tsx`; added status + reassign selects to `task-drawer.tsx`. PostgREST embed disambiguated via `member_roles!organization_member_id`.
- **Verified live:** pm@ created **UPI-116** assigned to Dev Rao (persisted after refresh) → dev@ received `TASK_ASSIGNED` notification, saw it in My Work, moved it to `IN_PROGRESS`; dev@ correctly 403 on the eligible-members endpoint.
- Tests: vitest 35/35; lint clean for new files (2 pre-existing `signup/page.tsx` errors remain, unrelated).

### 2026-06-27 — Auth C: Live Validation & Account Requirements
- Implemented comprehensive client and server-side Zod validation for signup fields.
- Added live password strength meter with specific requirement checks (length, match, composition).
- Created `lib/auth/reserved-identifiers.ts` and integrated it to block reserved slugs and usernames.
- Added `POST /api/v1/auth/workspace-slug-availability` endpoint.
- Updated `app/signup/page.tsx` with dynamic dropdowns for Job Family, Title, and Specialization with conditional "Other" custom inputs and Manager Type warnings.
- Added unit and integration tests for validation rules resulting in 35/35 passing tests.

### 2026-06-27 — Auth C: Company Owner Signup and Onboarding
- Designed a multi-step split-screen `/signup` UI using Handoff brand guidelines.
- Developed `POST /api/v1/auth/username-availability` leveraging service-role keys for secure DB checks.
- Developed `POST /api/v1/auth/signup` orchestrating `auth.signUp`, `profiles` injection, and the `create_organization` RPC in a secure flow.

### 2026-06-27 — Auth A: Database, username, roles, invite security
- Created migration `0024_auth_a_signup_roles.sql`.
- Added `username_normalized` lowercase/trim constraints.
- Created relational `organization_invite_roles` scoped by `organization_id`.
- Added `company_size` and `description` to `organizations`.
- Added `team_type` and new Project Manager RPCs (`create_project_team`).
- Configured RLS for `project_teams` and `teams` to enforce project-level permissions.
- DB reset passed. Tests passed (25/25).

### 2026-06-27 — Auth Sub-Phase B: Login With Username or Email
- Implemented `POST /api/v1/auth/login` allowing login with username or email using a service-role bypass to securely lookup username-to-email without leaking information.
- Created `lib/auth/rate-limit.ts` for in-memory brute-force protection.
- Redesigned `/login` to a high-end enterprise aesthetic with dark mode support.
- Built `/select-workspace` to handle users with multiple active organizations.
- Added strict checks to block suspended users at login.
- Changed files: `app/api/v1/auth/login/route.ts`, `app/login/page.tsx`, `lib/auth/rate-limit.ts`, `app/select-workspace/page.tsx`.

### 2026-06-27 — Auth Sub-Phase A: Schema and Security Foundation
- Created migration `0023_auth_and_onboarding.sql` to extend `profiles` (usernames), `organization_members` (professional data), and `organization_invites` (secure hashed tokens + role assignment fields).
- Ensured `invite_token_hash` index replaces plain-text `token` logic for security.
- Recreated `get_invite` and `accept_invite` RPCs to use hashed tokens and handle new fields properly.
- Run: `npx supabase db reset`, `npm run lint`, `npx vitest run`.
- Result: Migration applied cleanly, 25/25 tests passed. Passwords remain isolated exclusively to Supabase Auth.
- Changed files: `supabase/migrations/0023_auth_and_onboarding.sql`.

### 2026-06-27 — Phases R4–R7: Storage, team visibility, custom roles, Playwright E2E
- **R4 Storage** (`0019`): private buckets avatars/attachments/documents + org-scoped RLS on storage.objects (path = `{org_id}/...`, `handoff.storage_org_ok`). `services/attachment.service.ts` + `app/api/v1/tasks/[taskId]/attachments` (size/type validation, signed download URLs). Task drawer upload UI. Verified: member upload OK, cross-org upload BLOCKED.
- **R5 Team-on-project** (`0020`): `handoff.in_project_team` added to `can_view_project` — team members see projects via `project_teams`. Seed links Payments Platform → UPI.
- **R6 Custom roles** (`0021`): role_permissions manage RLS (org roles only, member:manage). `services/role.service.ts` + `/api/v1/roles`, `/api/v1/roles/[id]`, `/api/v1/permissions`. Settings UI `app/dashboard/settings/roles`. Verified: owner creates role + perms (201), non-admin 403, system roles immutable (403).
- **R7 Playwright E2E**: `playwright.config.ts` (runs against prod build via webServer, retries:1), `tests/e2e/auth.setup.ts` (per-role storageState), `tests/e2e/role-workflows.spec.ts` — 9 workflows (company create→owner, employee gating UI+API, PM create/assign→employee My Work, realtime board live, comment mention→notification, team-manager visibility, cross-org isolation, release gating). `npm run test:e2e`. Result: **13 passed**.
- **Bug fixed** (`0022`): `/api/v1/employees` embed was broken (no FK org_members→profiles); added `org_members_profile_fk`, fixed embed. Teams page now shows members.
- Verified: lint 0, vitest 25/25, e2e 13/13, build OK.
- NOTE: after `npx supabase db reset`, Kong caches the old auth container IP → auth 502. Fix: `docker restart supabase_kong_handoff supabase_rest_handoff supabase_edge_runtime_handoff`. E2E must run against `npm run build && npm run start` (prod), NOT `next dev` (on-demand compile too slow → timeouts).

### 2026-06-27 — Phase R3: Developer-status page + owner access fix
- API `GET /api/v1/dev/status` (dev-only, owner/admin only): checks auth/database/storage; returns env, session, org, roles, effective permissions, org-scoped seed counts.
- Page `app/dashboard/settings/developer-status/page.tsx`: 4 connection tiles (auth/db/storage + client-side realtime ping), session/env/roles/permissions/seed panels; gated to admins via context.
- Migration `0018`: added ORG_OWNER to `can_view_project` + `can_manage_project` (bug found via the status page — owner saw 0 projects/tasks; now sees 7/105).
- Verified: lint 0, build OK, vitest 25/25. Browser (as ORG_OWNER): all 4 connections green, 49 permissions, full session/env shown.

### 2026-06-27 — Phase R2: Onboarding, invites, org switcher
- Migrations: `0016` (`get_invite`/`accept_invite` SECURITY DEFINER RPCs — invitee joins org + role, validates token/expiry/email), `0017` (`create_organization` now assigns ORG_OWNER).
- API: `POST /api/v1/organizations/active` (sets validated `handoff_active_org` cookie); `GET/POST /api/v1/members/invite` (create + list invites, returns accept_url for local dev, blocks SUPER_ADMIN/ORG_OWNER via invite); `GET/POST /api/v1/invites/accept`.
- UI: multi-step onboarding `/onboarding/company`→`/team`→`/invite`→`/project` with `components/onboarding/step-shell.tsx` progress; `/onboarding` redirects to company. Accept page `app/invite/[token]/page.tsx`. Org switcher `components/dashboard/org-switcher.tsx` in shell (only shows for multi-org users; sets active-org cookie + refresh).
- `lib/constants/roles.ts` updated with ORG_OWNER + TEAM_MANAGER.
- Verified: lint 0, build OK, vitest 25/25. REST: invite create → new signup → accept → joins Apex as DEVELOPER (0 orgs before, 1 after). Browser: onboarding step 1/4 renders.

### 2026-06-27 — Phase R1: Roles, permissions, active-org, UI gating, role-scoped dashboard
- Migrations: `0013` (ORG_OWNER + TEAM_MANAGER roles, qa:view/qa:update perms, has_permission/member_permissions treat ORG_OWNER as full-access), `0014` (`handoff.is_team_manager`, `manages_member_team`, `can_assign_to` + team-scoped task_assignees insert/update/delete policies), `0015` (removed analytics:view from DEVELOPER).
- Active-org cookie: `lib/auth/get-current-membership.ts` now honors `handoff_active_org` cookie (re-validated server-side) with fallback to first membership. Exported `ACTIVE_ORG_COOKIE`.
- Client permission context: `lib/permissions/context.tsx` (`MembershipProvider`, `useCurrentMembership`, `usePermission`). Wired via `app/dashboard/layout.tsx` → `components/dashboard/shell.tsx` (provides context + filters nav by `perm`).
- UI gating: Kanban "New Task" gated by `task:create` (`components/tasks/kanban-board.tsx`); shell "Init_Task" gated by `task:create`.
- Role-scoped Overview: `app/dashboard/page.tsx` renders `components/dashboard/employee-overview.tsx` for users without `analytics:view`; managers/admins keep analytics.
- Seed: added `owner@` (ORG_OWNER) + `tm@` (TEAM_MANAGER) demo users; TM is lead of Payments Platform with dev as member + UPI project view access.
- Verified: lint 0, build OK, vitest 25/25 (incl. new `tests/integration/team-roles.test.ts`: employee can't assign, TM assigns own-team member, TM can't assign cross-team, owner has all perms). REST boundary check passed. In-browser: developer sees personal overview, no Init_Task, Analytics nav hidden.

### 2026-06-28 — Real Gemini AI integration + frontend fixes
- Replaced the deterministic mock AI with a real, server-side **Google Gemini** provider (`@google/genai`, model `GEMINI_MODEL` default `gemini-2.5-flash`; key server-only). New shared layer: `lib/ai/gemini-provider.ts`, `ai-context-builder.ts`, `ai-permission-checks.ts`, `intents.ts`, `ai-streaming.ts` (reuses `source-href.ts`).
- One streaming SSE endpoint `app/api/v1/ai/stream` for all intents (ask, daily-brief, my-focus, qa-security, release-readiness, exec-briefing, summarize-project/sprint/task/comments/incident/release/qa, task-plan). Auth + `ai:use` + feature permission enforced before any stream; 401/403 verified.
- Grounding contract: every answer uses only RLS-filtered, org-scoped FACTS; citations are emitted from a server-controlled candidate set (no fabrication); truthful empty states skip the model. Read-only; task-plan is draft-only.
- Frontend: `AiPanel`/`AiDailyBrief` stream tokens with `ANALYZING_WORKSPACE_DATA…` + Stop Generation (AbortController); dropdown `pointer-events`/AnimatePresence fixes; wired previously-dead buttons on project, sprint, QA/security, task drawer, incident, and release pages.
- Migration `0027_ai_request_metadata.sql` (model_name, intent, completed_at); `ai_requests` now logs provider_mode `gemini`, model, intent, sources, status — saved only on completion (cancel/fail not saved as final).
- Verified end-to-end in browser: Daily Brief + insight panels stream real grounded answers with clickable real citations; 23/23 AI tests pass (unit: registry/permissions/missing-key; integration: grounding, org isolation, empty state).

### 2026-06-26 / 2026-06-27 — Foundational build (Phases 1–8 of original spec)
- Migrations 0001–0012; full multi-tenant schema + RLS; ~70 API routes; services layer; realtime; mock AI; seed; tests (21 passing); docs. All dashboard pages wired to live data. Multi-company isolation verified (RLS integration test: org A cannot read org B; outsider sees nothing). Release gating verified. Realtime verified headless + two-browser.
- Result: lint 0, build success, vitest 21/21, db reset clean.

---

## Partial Work History
- Active-org selection: always first membership (no cookie scope) — to finish in R1.
- Onboarding: single-step only — to finish in R2.

---

## Test History
- 2026-06-27: `npx vitest run` → 21/21 passed (unit: permissions, domain, ai; integration: rls isolation, release gating).
- 2026-06-27: `node scripts/verify-realtime.mjs` → PASS (PM insert → Dev live receive).

---

## Changed Files History
- See git working tree. Key dirs: `supabase/migrations`, `services/`, `app/api/v1/`, `lib/`, `hooks/`, `components/`, `app/dashboard/`, `tests/`, `docs/`.
