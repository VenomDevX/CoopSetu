<h1 align="center"><sup><img src="public/logo.svg" alt="CoopSetu logo" width="38" height="38" align="absmiddle" /></sup> CoopSetu</h1>

<p align="center">
  <strong>Cooperative Training Hub</strong> — a single digital backbone for cooperative training institutions:
  training ERP, e-learning, verifiable certification, skill passports, an employment exchange, and an AI career assistant.
</p>

<p align="center">
  Built for <strong>Smart India Hackathon — Problem Statement 26087</strong>.
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" /></a>
  <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Gemini-AI%20Assistant-4285F4?style=flat-square&logo=googlegemini" alt="Gemini" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" alt="Proprietary License" /></a>
</p>

---

## 📖 What is CoopSetu?

Cooperative training in India runs across a network of institutions (NCCT, VAMNICOM, RICM, ICM and state-level
centres) whose registration, attendance, coursework, certification and placement data live in disconnected
silos. CoopSetu unifies that lifecycle in one multi-tenant workspace:

```text
                        ┌──────────────────────────┐
                        │      COOPERATIVE HUB     │
                        │        CENTRAL ERP       │
                        └────────────┬─────────────┘
            ┌────────────────────────┼────────────────────────┐
            ↓                        ↓                        ↓
       TRAINING ERP              E-LEARNING                AI ENGINE
            │                        │                        │
     Institutions              Courses & modules       Career chatbot
     Programmes & batches      Assessments             Skill matching
     Trainees & trainers       Progress tracking       Recommendations
     Attendance & sessions     Certificates            Analytics
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     ↓
                           ┌───────────────────┐
                           │ EMPLOYMENT EXCHANGE│
                           └─────────┬─────────┘
                                     ↓
                         Employers · Jobs · Applications
```

A trainee registers once, and the same identity carries their attendance, course progress, assessment results,
verified skills, certificates and job applications end to end.

---

## 👥 Roles

| Role | Can do |
| --- | --- |
| **Super Admin / NCCT** | Manage all institutions and programmes, monitor national registration & employment statistics, verify certifications, generate reports |
| **Institute Admin** | Create batches, schedule sessions, manage trainees and trainers, run attendance, upload learning material, conduct assessments |
| **Trainer** | View assigned batches, upload lectures, author assessments, mark and verify attendance, track trainee progress |
| **Trainee** | Enrol in programmes, take courses and assessments, view attendance, download certificates, build a skill passport, apply for jobs, use the career AI |
| **Employer** | Maintain a company profile, post jobs with required skills, search and shortlist candidates |

Role resolution lives in [`lib/auth/dashboard-persona.ts`](lib/auth/dashboard-persona.ts); the full role code list
is in [`lib/constants/roles.ts`](lib/constants/roles.ts). Personas drive **presentation only** — every data access
is independently authorised by Postgres Row Level Security.

---

## ✨ Features

### Training ERP
* **🏛️ Institutions & Programmes** — Register training institutions, define programmes, and roll them out to batches.
* **📋 Batches & Enrolment** — Batch scheduling, trainee enrolment, trainer assignment.
* **🧑‍🏫 Trainee & Trainer Directories** — Profiles, batch membership, progress at a glance.

### Attendance — four capture methods
* **📱 Dynamic QR + TOTP digital ID card** — Each trainee carries a rotating 30-second TOTP QR code (`/dashboard/id-card`) that can't be screenshotted and reused.
* **🙂 Face recognition** — Browser-side `face-api.js` embeddings, registered per trainee and matched at check-in.
* **🔌 Hardware scanner endpoint** — `POST /api/v1/hardware/scan` accepts `coopsetu:<trainee_id>:<totp>` payloads from a physical scanning device.
* **✍️ Manual marking** — Trainer-verified session attendance as a fallback.

### E-Learning & Certification
* **📚 Courses & modules** — Structured learning material with per-trainee progress tracking.
* **📝 Assessments** — Question banks, submissions and results tied back to enrolment.
* **🎓 Verifiable certificates** — Issued on completion and verifiable **publicly, without login**, via `GET /api/v1/certificates/verify?cert_number=…`.

### Skills & Employment
* **🪪 Skill Passport** — A trainee's verified skill set with proficiency, source and an **employment-readiness score** aggregating certificates and completed courses.
* **💼 Employment Exchange** — Employer profiles, job postings with required skills, and candidate applications.
* **🤖 Career AI** — Gemini-backed assistant for skill-gap analysis, course recommendations and cooperative-sector career guidance.

### Delivery & Governance core
* **📅 Projects, Sprints & Boards** — Kanban boards, sprint start/complete flows, burndown charts, epics, milestones and risks.
* **🚀 Releases & Approvals** — Approval-gated release pipelines with deployment logs.
* **🚨 Incidents & Post-mortems** — Incident timelines, exportable post-mortems.
* **🛡️ QA & Security Workspace** — Bug tracking, test plans and security reviews.
* **📄 Documentation** — Collaborative docs with comments and approval flows.
* **📊 Analytics & Scheduled Reports** — Dashboards plus a background worker that emails scheduled report exports.
* **⚡ Realtime** — Live board updates, presence and notifications over Supabase Realtime.
* **🔍 Audit Trails** — Every state change recorded, with IP and user-agent HMAC-hashed rather than stored raw.

### Try it without setup
A **guest demo mode** (`/api/v1/demo/*`) provisions a throwaway workspace seeded with realistic data, lets you
switch personas, and is reaped nightly by a Vercel cron job.

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| **Framework** | Next.js 15 (App Router, Server Components, Server Actions), React 19 |
| **Language** | TypeScript 5.9 |
| **Database** | Supabase Postgres — 75 SQL migrations, Row Level Security on every table |
| **Auth** | Supabase Auth with SSR middleware; GitHub & Google OAuth |
| **Realtime** | Supabase Realtime channels (boards, notifications, presence) |
| **AI** | Google Gemini via `@google/genai`, behind a swappable provider interface (`lib/ai/provider.ts`) |
| **Cache / Rate limiting** | Upstash Redis (with in-process fallback) |
| **UI** | Tailwind CSS 4, Radix UI primitives, `motion` / GSAP, Recharts, `lucide-react` |
| **Validation** | Zod 4 (strict schemas on API input) |
| **Email / PDF / QR** | Nodemailer, PDFKit, `qrcode` + `otplib` / `totp-generator`, `html5-qrcode`, `face-api.js` |
| **Testing** | Vitest (unit + integration), Playwright (E2E), k6 (load) |
| **Deploy** | Vercel (primary) or Docker |

---

## 📁 Project Structure

```text
├── app/
│   ├── api/v1/           # 120 REST route handlers (versioned API surface)
│   ├── dashboard/        # Role-aware workspace: trainees, trainers, batches, courses,
│   │                     # attendance, certificates, skill-passport, career-ai, id-card,
│   │                     # jobs, employers, institutions, programmes, assessments,
│   │                     # analytics, approvals, releases, teams, settings, …
│   ├── onboarding/       # Workspace-path, profile, company, team and invite flows
│   ├── auth/ login/ signup/ invite/ …
│   └── page.tsx          # Public marketing landing page
├── components/           # UI library (Radix-based `ui/`, plus feature components)
├── hooks/                # Realtime + presence React hooks
├── lib/
│   ├── ai/               # Gemini provider, context builder, intents, prompt safety
│   ├── auth/             # Session, membership, persona and rate-limit helpers
│   ├── security/         # AES-256-GCM encryption, rate limiting, IP utils
│   ├── supabase/         # Browser / server / admin / middleware clients
│   └── api/ audit/ cache/ email/ notifications/ realtime/ validation/ …
├── services/             # 37 domain services (one per module: trainee, batch, course,
│                         # attendance, certificate, skill, employer, sprint, release, …)
├── supabase/
│   ├── migrations/       # Schema, RLS policies and security hardening (0001 → 0077)
│   └── seed.sql          # Demo org, members, projects, sprints, releases, incidents
├── scripts/              # Report worker, demo-session cleanup, realtime verification
├── tests/                # unit/ · integration/ · e2e/ (Playwright) · load/ (k6)
├── public/models/        # face-api.js model weights (served to the browser)
└── Dockerfile · docker-compose.yml · vercel.json · middleware.ts
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js** 20 or higher (CI runs on 22)
* **npm**
* A **Supabase** project, and the [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations
* A **Google Gemini** API key (for the AI assistant and career chatbot)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/VenomDevX/CoopSetu.git
   cd CoopSetu
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Minimum to boot locally:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   SUPABASE_SECRET_KEY=your-service-role-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-gemini-api-key
   # 32-byte base64 key for encrypting integration secrets:
   #   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ENCRYPTION_KEY=
   ```
   [`.env.example`](.env.example) documents the full set — Upstash Redis, SMTP, GitHub/Google OAuth,
   `AUDIT_HMAC_SECRET`, `CRON_SECRET` — and marks which are server-only. Only `NEXT_PUBLIC_`-prefixed
   variables reach the browser; everything else must stay unprefixed.

   > ### ⚠️ Rotate any secret that was ever committed
   > All secrets load exclusively from environment variables. If a secret (Supabase service-role key,
   > `GEMINI_API_KEY`, `ENCRYPTION_KEY`, OAuth client secrets, SMTP or Upstash credentials, `CRON_SECRET`)
   > was **ever** committed or hardcoded, it stays recoverable in git history even after removal.
   > **Rotate it in the provider dashboard before deploying** and treat the old value as compromised.
   > `.env.local` is gitignored — never commit it.

4. **Apply the database schema**
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```
   On a local stack you can also load the demo dataset in [`supabase/seed.sql`](supabase/seed.sql)
   (a seeded organisation with members, projects, sprints, releases and incidents):
   ```bash
   supabase db reset            # re-runs every migration, then applies seed.sql
   ```

5. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

6. **Optional — background report worker**
   ```bash
   npm run worker:reports
   ```

---

## 🧪 Testing

```bash
npm run lint              # ESLint (flat config)
npm run test              # Unit tests            (tests/unit)
npm run test:integration  # Integration tests     (tests/integration — needs Supabase creds)
npm run test:all          # Both suites
npx playwright install    # one-time browser download
npm run test:e2e          # End-to-end            (tests/e2e)
```

Load testing with [k6](https://k6.io/):

```bash
npm run load:smoke        # Unauthenticated smoke profile
npm run load:auth         # Authenticated user profile
npm run load:student      # Student/team workflow profile
```

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push and PR to `main`:
TruffleHog verified-secret scanning, `npm audit --audit-level=high`, then lint, type-checked build and unit tests
as an independent job so a scan failure never masks test results.

---

## 🔒 Security

Security is enforced in depth rather than at a single layer:

* **Row Level Security** on every table — the browser-exposed anon key can only ever read what policy allows.
* **Content Security Policy with a per-request nonce**, generated in [`middleware.ts`](middleware.ts) and threaded through the root layout.
* **Rate limiting** per IP and route category (auth limits are tighter than general API limits), backed by Upstash Redis.
* **Bot filtering** — API requests with missing or scripted user agents are rejected.
* **AES-256-GCM encryption** for stored integration secrets (`lib/security/encryption.ts`).
* **Audit logging** with HMAC-hashed IP and user-agent — the app fails closed in production if `AUDIT_HMAC_SECRET` is unset rather than falling back to a default.
* **Session management and IP allowlisting** for privileged workspaces.
* **Hardened database functions** — `SECURITY DEFINER` functions have `EXECUTE` revoked from `anon` and pinned `search_path` (migrations 0068–0070).

---

## 🌐 Deployment

### Vercel (recommended)

1. Import the repository into [Vercel](https://vercel.com) — the Next.js preset is detected automatically.
2. Add every variable from `.env.local` under **Settings → Environment Variables**.
3. In Supabase, set **Authentication → URL Configuration** to your deployed site URL and redirect URLs.
4. [`vercel.json`](vercel.json) registers a daily cron at `/api/v1/demo/cleanup` — set `CRON_SECRET` so the endpoint authenticates the call.

### Docker

```bash
docker compose up --build
```

The app is served on port `3000` using `.env.local` for configuration ([`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml)).

---

## 🤝 Contributing

1. Branch off `main`.
2. Keep `npm run lint`, `npm run build` and `npm run test` green — CI enforces all three.
3. Schema changes go in a **new** numbered migration under `supabase/migrations/`; never edit an applied one.
4. New tables must have RLS enabled before merge — the anon key is public.
5. Never commit secrets; TruffleHog scans full history on every PR.

---

## 📄 License

Proprietary — all rights reserved. No use, copying, modification or distribution without written permission. See [`LICENSE`](LICENSE).
