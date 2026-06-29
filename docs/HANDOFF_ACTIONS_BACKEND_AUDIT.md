# Handoff Actions Backend Audit

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
