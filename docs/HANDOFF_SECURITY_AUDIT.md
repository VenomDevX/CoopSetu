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

## Audit C: Public Endpoints & Abuse Protection (Contact Requests)

**Status:** COMPLETED

### 1. Direct Database Access Controls
- **Audit:** Checked RLS policies for `public.contact_requests` table.
- **Findings:** `contact_requests` has RLS enabled. No insert/select/update/delete policies are defined. Direct interaction from any client (authenticated or anonymous) via Supabase Client SDK is completely blocked by default (returns 403 / RLS error).
- **Enforcement:** Ingestion is restricted to the backend API route `POST /api/v1/contact` using the server-side Supabase Admin client (`createAdminClient()`).

### 2. Contact Request Rate Limiting
- **IP-Based Limit:** Gated at 5 requests per 15 minutes. Checked using the Supabase RPC rate limiter `check_rate_limit()` inside the route. Returns a `429 Too Many Requests` status code and a `Retry-After: 900` header when triggered.
- **Email-Based Limit:** Gated at 3 requests per 24 hours. The route queries the `contact_requests` table to count submissions for the normalized lowercase email in the last 24 hours. Returns `429 Too Many Requests` and a `Retry-After: 86400` header when triggered.
- **Header Trust:** IP resolution does not rely on arbitrary client-supplied headers. It extracts headers from trusted reverse proxy variables (`x-forwarded-for`, `x-real-ip`) or NextRequest ip variables with safe local defaults.

### 3. Honeypot and Max Message Constraints
- **Honeypot:** A hidden field (`honeypot`) is rendered on the client. If populated, the API marks the submission as `honeypot_triggered = true` and saves it, but responds with a generic success response to keep the bot un-alerted. Filtered out from normal user visibility.
- **Constraints:** Max message length is restricted to 3000 characters. All inputs are validated via Zod schemas both on the client and server.

### 4. PII Protection (Hashes)
- **Findings:** Raw Client IP addresses and User-Agent strings are NOT stored in the database. Instead, the SHA-256 hashes (`ip_hash` and `user_agent_hash`) are computed and stored, protecting submitter anonymity.
- **Escaped rendering:** When rendering contact requests in the database dashboard (for future platform admins), all fields must be rendered as escaped text. `dangerouslySetInnerHTML` is not used.

## Audit D: Private Task Visibility

**Status:** IMPLEMENTED / INTEGRATION BLOCKED

### 1. Project Membership No Longer Implies Private Task Access
- **Finding fixed:** `tasks_select` and task-adjacent policies previously used `handoff.can_view_project(project_id)`, so any user with project visibility could read private task rows, comments, activity, assignment rows, and attachments.
- **Fix:** `supabase/migrations/0047_private_task_visibility.sql` adds `handoff.can_view_task(task_id)` and rewires task, assignment, comment, mention, attachment, activity, checklist, label, dependency, watcher, and time-entry policies to use it.
- **Result:** Private tasks are visible only by direct task relationship, explicit grant, responsible manager/admin authority, or managed-assignee authority.

### 2. Assignment History Integrity
- **Finding fixed:** `task_assignees` used a single unique row per task/member and application code used upsert, losing reassignment history.
- **Fix:** `task_assignees` now stores `assignment_type`, `assigned_by_member_id`, `removed_at`, and `removed_by_member_id`, with a partial unique index only for active rows.
- **Result:** Reassignment preserves old rows and revokes old assignee visibility when no other rule applies.

### 3. Explicit Visibility Grants
- **Fix:** New `task_visibility_members` table with tenant guard and RLS.
- **Result:** Reviewers/observers can be granted access without changing project membership or broadening the task to the full project.

### 4. Regression Coverage
- `tests/integration/private-task-visibility.test.ts` covers hidden private tasks, hidden adjacent rows, manager/admin visibility, reviewer/explicit grants, My Work inclusion, and reassignment history.
- Verification passed for DB reset, lint, typecheck, and unit tests. The focused integration suite is currently blocked by local Supabase HTTP timeouts and a Docker Desktop Linux engine 500 after reset.
