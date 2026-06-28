# Handoff

Handoff brings projects, sprints, teams, releases, documentation, compliance, and AI intelligence into one hyper-structured, high-performance workspace.

## Features

- **Projects & Sprints** — Kanban boards, sprint planning, burndown tracking
- **Tasks** — Full task lifecycle with assignees, priorities, security classifications, and real-time updates
- **Teams & Members** — Role-based access control with custom roles and permissions
- **Releases** — Approval-gated deployments with release management
- **Incidents** — Incident tracking with timelines and post-mortems
- **QA & Security** — Bug tracking and security review workflows
- **Documents** — Collaborative documentation with approval flows
- **AI Assistant** — Context-aware AI panel powered by Gemini for task planning, summaries, and insights
- **Real-time** — Live presence, notifications, and board updates via Supabase Realtime
- **Audit Logs** — Full audit trail across all entities

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Database** — Supabase (PostgreSQL + Row Level Security)
- **Auth** — Supabase Auth
- **AI** — Google Gemini
- **Styling** — Tailwind CSS
- **Deployment** — Vercel + Supabase

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI
- A Supabase project

### Local Development

1. Clone the repo:

```bash
git clone https://github.com/VenomDevX/HANDOFF.git
cd HANDOFF
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment variables:

```bash
cp .env.example .env.local
```

4. Fill in `.env.local` with your Supabase project credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=your-gemini-api-key
AI_PROVIDER=gemini
```

5. Push the database migrations:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

6. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server-only, never expose to browser) |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app |
| `GEMINI_API_KEY` | Google Gemini API key |
| `AI_PROVIDER` | AI provider (`gemini`) |

## Deployment

### Vercel + Supabase

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel project settings
4. Deploy

In Supabase, set your Vercel domain as the Site URL under **Authentication → URL Configuration**.

## License

MIT
