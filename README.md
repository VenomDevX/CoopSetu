<h1 align="center">
  <img src="public/logo-dark.png" alt="Handoff Logo" width="32" height="32" align="middle" /> Handoff
</h1>

<p align="center">
  Handoff brings projects, sprints, teams, releases, documentation, compliance, and AI intelligence into one hyper-structured, high-performance workspace. Designed for engineering and product teams to sync seamlessly.
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-Database%20%26%20Auth-blueviolet?style=flat-square&logo=supabase" alt="Supabase" /></a>
  <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Google%20Gemini-AI%20Assistant-blue?style=flat-square&logo=google-gemini" alt="Gemini" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" /></a>
</p>

---

## ✨ Features

*   **📅 Projects & Sprints** — Interactive Kanban boards, agile sprint planning, and burndown chart tracking.
*   **✅ Task Lifecycle** — Manage tasks with custom priorities, assignees, security classifications, and real-time state updates.
*   **👥 Role-Based Access (RBAC)** — Secure team workspaces with custom roles and permission control.
*   **🚀 Release Management** — Automated release pipelines with approval-gated deployments.
*   **🚨 Incidents & Post-mortems** — Log incidents, maintain resolution timelines, and compile collaborative post-mortems.
*   **🛡️ QA & Security Workspace** — Streamlined bug tracking coupled with compliance and security review workflows.
*   **📄 Rich Documentation** — Collaborative docs editor with revision history and publishing approval flows.
*   **🤖 Context-Aware AI Assistant** — Side-panel powered by Gemini to help summarize tasks, draft post-mortems, and offer project insights.
*   **⚡ Real-Time Collaboration** — Live user presence, instant board updates, and global notifications powered by Supabase Realtime.
*   **🔍 Comprehensive Audit Trails** — Track every state change, document approval, and sprint transition automatically.

---

## 🛠️ Tech Stack

*   **Frontend & Routing:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, Client Hydration)
*   **Database & Real-time:** [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security policies, Realtime subscriptions)
*   **Authentication:** Supabase Auth (SSR-compatible middleware)
*   **AI Integration:** Google Gemini SDK (`@google/genai`)
*   **Styling:** Tailwind CSS & Radix UI primitives
*   **Testing:** Vitest (Unit/Integration) & Playwright (End-to-End)

---

## 📁 Project Structure

```text
├── app/                  # Next.js pages, layouts and API routes
├── components/           # Reusable UI component library (Shadcn + Radix)
│   └── ui/               # Core atomic components (button, input, textarea, etc.)
├── hooks/                # Custom React Hooks
├── lib/                  # Shared utility functions (supabase client, api wrapper)
├── services/             # API and business logic helpers (Gemini integrations)
├── supabase/             # Local database schema, seed files, and migration scripts
├── tests/                # Testing suites
│   ├── integration/      # Integration test flows
│   └── unit/             # Unit tests for helpers & hooks
├── playwright.config.ts  # End-to-end testing configuration
└── next.config.ts        # Next.js configurations
```

---

## 🚀 Getting Started

### Prerequisites

*   **Node.js** 18.17.0 or higher
*   **Supabase CLI** (for local migrations)
*   A active project on **Supabase**

### Local Development Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/VenomDevX/HANDOFF.git
    cd HANDOFF
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Duplicate the example file and populate the credentials:
    ```bash
    cp .env.example .env.local
    ```
    Populate `.env.local`:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
    SUPABASE_SECRET_KEY=your-service-role-key
    NEXT_PUBLIC_APP_URL=http://localhost:3000
    GEMINI_API_KEY=your-gemini-api-key
    AI_PROVIDER=gemini
    ```

4.  **Database Migration**
    Link your local CLI configuration to your remote Supabase instance:
    ```bash
    supabase link --project-ref your-project-ref
    supabase db push
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view your local workspace.

---

## 🧪 Testing

Handoff includes a robust testing configuration:

*   **Run Unit Tests:**
    ```bash
    npm run test
    ```
*   **Run Integration Tests:**
    ```bash
    npm run test:integration
    ```
*   **Run End-to-End Tests:**
    ```bash
    npx playwright install
    npm run test:e2e
    ```

---

## 🌐 Deployment

### Frontend (Vercel)

1.  Connect your GitHub repository to [Vercel](https://vercel.com).
2.  Configure build settings (automatically detected as Next.js).
3.  Inject variables from `.env.local` into the **Environment Variables** panel in Vercel.
4.  Configure CORS and Site URL settings in your Supabase Auth panel under `Authentication -> URL Configuration`.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
