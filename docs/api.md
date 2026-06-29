# Handoff — API

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

## Implemented so far

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
