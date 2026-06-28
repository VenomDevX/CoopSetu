# Handoff — Local Development

Handoff runs fully locally against a Dockerized Supabase stack. No cloud, Git,
deployment, or external API credentials are required.

## 1. Required software

- Node.js 20+
- Docker Desktop (running)
- The Supabase CLI is installed as a dev dependency (`npx supabase ...`)

## 2. Start Docker Desktop

Make sure the Docker daemon is running before starting Supabase.

## 3. Install dependencies

```bash
npm install
```

## 4. Initialise / start local Supabase

The project is already initialised (`supabase/config.toml`, `project_id = "handoff"`).
Start the stack:

```bash
npx supabase start
```

First run pulls Docker images (several minutes). When it finishes it prints the
local keys. The publishable key is already wired into `.env.local`.

## 5. Environment variables (`.env.local`)

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

## 6. Apply migrations + seed

```bash
npx supabase db reset
```

This drops the local DB, re-applies every migration in `supabase/migrations`,
then loads `supabase/seed.sql` (demo org + users).

## 7. Run the app

```bash
npm run dev
```

## 8. Local URLs

| Service        | URL                          |
| -------------- | ---------------------------- |
| App            | http://localhost:3000        |
| Supabase API   | http://127.0.0.1:54321       |
| Studio         | http://127.0.0.1:54323       |
| Mailpit (mail) | http://127.0.0.1:54324       |
| Postgres       | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

## 9. Demo user credentials

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

## 10. Sign-up / onboarding

A brand-new sign-up (`/signup`) has no organization and is redirected to
`/onboarding`, where creating an org makes the user that org's `ORG_ADMIN`.

## 11. Testing realtime with two browser sessions

(Available once Phase 4 lands.) Open the app in a normal window signed in as the
PM and an incognito window signed in as the Developer, both on the same board,
and confirm changes propagate without refresh.

## 12. Stop local Supabase

```bash
npx supabase stop
```

Local data is preserved in a Docker volume between stops; `db reset` wipes it.
