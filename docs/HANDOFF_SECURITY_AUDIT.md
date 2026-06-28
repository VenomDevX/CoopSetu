# Handoff — Security Audit

Living document tracking the status of every security item checked, vulnerabilities found, and fixes applied.

## Audit A: Environment, Secrets, and Dependencies

**Status:** COMPLETED

### 1. Secret Exposure Scan
- **Git Tracked Files Check:** Verified via `git ls-files | grep -E '(^|/)\.env(\.|$)'` that no `.env` or `.env.local` files are tracked.
- **Git Grep For Secrets:** Scanned codebase for `AIza`, `sk-`, `service_role`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` (excluding `node_modules`).
- **Findings:** No live secrets or API keys have ever been committed or exposed. The keys are only referenced via `process.env` in the server-side code (never prefixed with `NEXT_PUBLIC_`). The only dummy values were found in `tests` which do not expose real credentials. 

### 2. `.env.example`
- **Finding:** Previously contained dummy values (`MY_GEMINI_API_KEY`).
- **Fix:** Removed all dummy values. The file now contains variable names only to prevent accidental copy-paste leakage.

### 3. `.gitignore` Rules
- **Finding:** `.env*` and `!.env.example` are correctly configured. No `.env.local` leakage possible.

### 4. Dependency Vulnerabilities
Results from `npm audit` and `npm audit --omit=dev`.

#### Vulnerability 1: PostCSS (Production Runtime)
- **Package:** `postcss`
- **Installed version:** `<8.5.10`
- **Dependency path:** `next` -> `postcss`
- **Production or Development:** Production dependency
- **Severity:** Moderate
- **Exploit preconditions:** XSS via unescaped `</style>` in CSS stringify output.
- **Whether Handoff production runtime is affected:** Unlikely. Handoff uses Tailwind CSS at build time and does not dynamically stringify user-provided CSS at runtime.
- **Safe upgrade path:** None. Wait for Next.js to bump the underlying `postcss` dependency.
- **Reason it is blocked:** `npm audit fix --force` would forcibly downgrade Next.js to `9.3.3`, which is a catastrophic breaking change.
- **Status:** BLOCKED / PARTIAL

#### Vulnerability 2: UUID (Development Tooling)
- **Package:** `uuid`
- **Installed version:** `<11.1.1`
- **Dependency path:** `firebase-tools` -> `gaxios` -> `uuid`
- **Production or Development:** Development-only tool
- **Severity:** Moderate
- **Exploit preconditions:** Missing buffer bounds check in v3/v5/v6 when buf is provided.
- **Whether Handoff production runtime is affected:** No. This is a local development CLI tool dependency.
- **Safe upgrade path:** None. Wait for `firebase-tools` to bump its dependencies.
- **Reason it is blocked:** `npm audit fix --force` would forcibly downgrade `firebase-tools` to `14.23.0`, breaking the CLI environment setup.
- **Status:** BLOCKED / PARTIAL

#### Vulnerability 3: OpenTelemetry Core (Development Tooling)
- **Package:** `@opentelemetry/core`
- **Installed version:** `<2.8.0`
- **Dependency path:** `firebase-tools` -> `@google-cloud/pubsub` -> `@opentelemetry/core`
- **Production or Development:** Development-only tool
- **Severity:** Moderate
- **Exploit preconditions:** Unbounded memory allocation in W3C Baggage propagation.
- **Whether Handoff production runtime is affected:** No. This is a local development CLI tool dependency.
- **Safe upgrade path:** None. Wait for `firebase-tools` to bump its dependencies.
- **Reason it is blocked:** `npm audit fix --force` would forcibly downgrade `firebase-tools`.
- **Status:** BLOCKED / PARTIAL

### 5. Verification
- `npm run lint` — **PASS**
- `npx vitest run` — **PASS (63/63)**
- No unsafe forced downgrade was performed.

## Audit B: Application Security & Tenant Isolation

**Status:** IN PROGRESS (Findings Identified)

### 1. Cross-Tenant Foreign Key Assignment (Relational IDOR)
- **Finding:** In `projects` and `tasks` tables, fields like `owner_member_id`, `project_manager_member_id`, and `primary_assignee_member_id` are foreign keys to `organization_members(id)`. However, there is no database constraint (like a composite foreign key) or API validation to ensure that the assigned member actually belongs to the *same* `organization_id` as the project/task.
- **Risk:** High. A malicious user could send an API request with an `owner_member_id` belonging to a different tenant. Because `organization_members(id)` is just a UUID, the foreign key constraint will pass. This pollutes cross-tenant data and could potentially leak visibility if RLS relies on these assignments.
- **Recommendation:** Implement composite foreign keys across all multi-tenant tables. For example: `FOREIGN KEY (organization_id, owner_member_id) REFERENCES organization_members(organization_id, id)`. Alternatively, use `BEFORE INSERT/UPDATE` triggers to enforce tenant boundary checks.

### 2. Hierarchy and Taxonomy IDOR
- **Finding:** Similar to member assignments, hierarchical links like `portfolio_id`, `program_id`, `epic_id`, and `sprint_id` lack tenant boundary constraints.
- **Risk:** Moderate/High. A user could link their `project` to a `portfolio` belonging to another organization.
- **Recommendation:** Use composite foreign keys (e.g., `FOREIGN KEY (organization_id, epic_id) REFERENCES epics(organization_id, id)`).

### 3. API-Layer Defense in Depth (Tenant Checks)
- **Finding:** In endpoints like `PATCH /api/v1/projects/[projectId]`, the application checks permissions against the user's active organization (`m.organizationId`) but executes the database update without explicitly filtering `eq('organization_id', m.organizationId)`.
- **Mitigation in Place:** Supabase Row Level Security (RLS) successfully catches this and prevents the cross-tenant update because `handoff.can_manage_project(id)` evaluates to false for out-of-tenant resources.
- **Recommendation:** Implement Defense in Depth. The backend service methods (e.g., `updateProject` in `services/project.service.ts`) should explicitly include `.eq('organization_id', orgId)` on all update/delete queries so the application actively rejects out-of-bounds requests before relying solely on RLS.

### 4. CSRF and XSS
- **Finding:** No instances of `dangerouslySetInnerHTML` were found in the codebase, significantly reducing XSS vectors.
- **Finding:** `lib/supabase/middleware.ts` enforces `application/json` `Content-Type` for all state-changing API routes (POST, PUT, PATCH, DELETE). Next.js Server Actions (like `setActiveWorkspace`) utilize built-in Origin/Host validation.
- **Risk:** Low. CSRF and XSS protections are robust.

### 5. API Secrets
- **Finding:** Re-verified environment variables. Only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are exposed to the client. Highly sensitive keys like `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` remain server-side only.
