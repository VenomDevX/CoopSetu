# Handoff — End-to-End Tests (Playwright)

E2E tests drive the real app + local Supabase across separate authenticated
role sessions (Owner, PM, Team Manager, Developer) and an unauthorized org.

## Prerequisites

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

## Run

E2E runs against a **production build** (fast, no on-demand compile). Stop any
`next dev` first, then:

```bash
npm run build
npm run start &          # serves http://localhost:3000
npm run test:e2e
```

`playwright.config.ts` has `webServer.reuseExistingServer: true`, so it reuses a
running server (or starts `npm run dev` if none — but prod is recommended).

## What is covered (`tests/e2e/role-workflows.spec.ts`)

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

## Notes
- `retries: 1` absorbs realtime timing flake; deterministic tests pass first try.
- Tests create some rows (tasks, orgs); run `npx supabase db reset` to clean.
