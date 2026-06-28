# Handoff — Security Hardening Plan

This document outlines the systematic approach to executing the security hardening phase for the Handoff application.

## Overview
Handoff is a multi-company enterprise application. Every sensitive action must enforce:
1. Authenticated user identity
2. Active organization membership
3. Role/permission validation
4. Record-level organization isolation
5. Server-side input validation
6. Supabase RLS protection
7. Safe error handling
8. Audit logging where relevant

## Execution Phases

### Phase A: Baseline Audit, Secrets, Environment Safety, Dependency Review (COMPLETED)
- Verified environment variables and `.env.example` safety.
- Verified `.gitignore` properly excludes secrets.
- Conducted a full git history scan to ensure no secrets were ever committed.
- Audited dependencies via `npm audit` and `npm audit --omit=dev`. Documented production vs. development vulnerabilities and blocked unsafe downgrades.

### Phase B: Route Authorization, Organization Isolation, and Supabase RLS Audit (NEXT)
- **API Routes:** Inspect all API routes for `requireUser()`, `requireOrganization()`, and specific permission checks (e.g., `requirePermission('task:create')`).
- **Input Validation:** Ensure Zod schemas are used for all request bodies and query parameters, rejecting unexpected data.
- **Error Handling:** Verify errors are caught and sanitized before being returned to the client.
- **RLS Verification:** Audit Supabase RLS policies for strict organizational isolation (`organization_id` matching).

### Phase C: AI Safety & Integration Hardening (PENDING)
- Verify `GEMINI_API_KEY` is handled securely server-side only.
- Implement or verify strict input sanitization for user prompts before sending them to Gemini.
- Implement or verify output validation/sanitization for responses received from Gemini.
- Ensure context provided to the AI is strictly scoped to the user's organization and permissions.

### Phase D: File Upload & Data Flow Security (PENDING)
- Audit Supabase Storage RLS policies.
- Verify server-side validation of file types, sizes, and malware scanning (if applicable).
- Verify that Supabase Postgres Changes subscriptions are properly scoped using RLS and channel names.

### Phase E: Frontend Data Security (PENDING)
- Ensure the frontend never trusts client-side state for authorization.
- Verify that any feature flags or UI toggles do not bypass backend security controls.

### Phase F: Final Audit & Penetration Testing (PENDING)
- Conduct a final review of the implemented fixes.
- Perform targeted manual testing on identified high-risk areas using the seeded demo accounts.
