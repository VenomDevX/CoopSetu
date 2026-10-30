# CoopSetu — Project Documentation

Unified documentation for the CoopSetu Cooperative Training & Attendance platform.

---

## Table of Contents

1. [Local Development](#1-local-development)
2. [Architecture](#2-architecture)
   - [Permissions & RLS](#permissions--rls)
   - [Realtime](#realtime)
3. [Features overview](#3-features-overview)
4. [Security & Deployment](#4-security--deployment)

---

# 1. Local Development

CoopSetu runs fully locally against a Dockerized Supabase stack. No cloud, Git,
deployment, or external API credentials are required to start developing.

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

Start the stack:

```bash
npx supabase start
```

First run pulls Docker images (several minutes). When it finishes it prints the
local keys. 

## 1.5 Environment variables (`.env.local`)

Ensure your `.env.local` file contains at least:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # from `supabase start`
COOPSETU_AI_MODE=mock
COOPSETU_ENABLE_MOCK_INTEGRATIONS=true
COOPSETU_ENABLE_DEV_SEED=true
SUPABASE_SECRET_KEY=sb_secret_...                         # server only, never NEXT_PUBLIC_
NEXT_PUBLIC_TEST_USER_PASSWORD=Password123!               # local demo password
```

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

## 1.9 Demo user credentials

All demo accounts use password **`Password123!`**. The login page has
one-click buttons for demo accounts.

| Role             | Email                     |
| ---------------- | ------------------------- |
| Org Owner        | owner@apexfintech.test    |
| Org Admin        | admin@apexfintech.test    |
| Trainer          | trainer@apexfintech.test  |
| Trainee          | trainee@apexfintech.test  |

All belong to the **Apex Financial Technologies** organization in the seed data.

---

# 2. Architecture

## Permissions & RLS

### Model

- **Roles**: System roles (e.g., ORG_ADMIN, TRAINER, TRAINEE, INSTITUTION_ADMIN).
- **Enforcement**: Database Row Level Security (RLS) is the ultimate source of truth. Every business table has RLS enabled.
- API guards (`requireUser`, `requireOrganization`) reject early with `401`/`403` before touching the DB.

### Key rules

- Users only ever see rows in organizations where they are an active member.
- Trainees can only mark their own attendance and view their own skill passports.
- Trainers can manage batches, courses, and view attendance for their assigned students.

## Realtime

Realtime is powered by Supabase `postgres_changes`. RLS still applies to realtime: a client only receives change events for rows it is allowed to read.

---

# 3. Features overview

### Cooperative Training
- **Institutions**: Management of partner institutions and branches.
- **Courses & Batches**: Trainers can create courses and assign trainees to batches.

### Attendance System
- **TOTP/QR**: ID Card generation and hardware TOTP verification for secure physical attendance.
- **Face Embedding**: Biometric facial recognition matching for physical presence.

### Skill Passport & Career AI
- **Skill Passports**: Trainees maintain a verified ledger of skills, achievements, and courses completed.
- **Career AI**: Gemini-powered AI that provides Daily Briefs, career trajectory recommendations, and skill gap analysis.

---

# 4. Security & Deployment

- **Keys**: `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` must never be exposed to the browser.
- **File Uploads**: All profile pictures and verification documents are stored in Supabase Storage with strict RLS policies.
- **Tenant Isolation**: Every database table includes an `organization_id` that is strictly enforced via Row Level Security (RLS). Cross-tenant data leakage is impossible at the DB level.
