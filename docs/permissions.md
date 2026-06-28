# Handoff — Permissions & RLS

## Model

- **Roles** (`roles`): system roles (`organization_id IS NULL`) seeded once, plus
  optional custom org roles. A member can hold multiple roles (`member_roles`).
- **Permissions** (`permissions`): fine-grained codes like `task:create`,
  `release:approve`. Roles map to permissions via `role_permissions`.
- **ORG_ADMIN** and **SUPER_ADMIN** implicitly have every permission.

## Enforcement layers (defense in depth)

1. **Database RLS** — the source of truth. Every business table has RLS enabled.
   Policies call `SECURITY DEFINER` helper functions in the `handoff` schema:
   - `handoff.is_org_member(org)` — active membership check
   - `handoff.has_permission(org, code)` — role/permission check (admins = all)
   - `handoff.has_role(org, codes[])`
   - `handoff.can_view_project(project)` / `can_manage_project` / `is_project_member`
   - `handoff.can_edit_task(task)` — managers, or the assignee
   These are `SECURITY DEFINER` to avoid policy recursion on their own tables.
2. **API guards** — `requireUser`, `requireOrganization`, `requirePermission`
   reject early with `401`/`403` before touching the DB.
3. **UI gating** — the membership's flat permission list (`member_permissions`
   RPC) hides actions the user can't perform. Cosmetic only; never trusted.

## Key rules

- Users only ever see rows in organizations where they are an **active member**.
  Changing a URL / id / request body cannot cross orgs — RLS blocks it.
- Developers can update only tasks assigned to them (or where they manage the
  project). Project managers can create/assign tasks in their projects.
- Client viewers must be **explicit project members** to see a project.
- Auditors can read `audit_logs` (`audit:view`) but the table has **no** update
  or delete policy, so logs are append-only from the client.
- `audit_logs`, `notifications`, and `project_activity` inserts go through
  `SECURITY DEFINER` RPCs, not direct client inserts.

## System roles (seeded)

SUPER_ADMIN, ORG_ADMIN, CEO, CTO, PROJECT_MANAGER, ENGINEERING_MANAGER,
TEAM_LEAD, DEVELOPER, QA_ENGINEER, DEVOPS_ENGINEER, SECURITY_ENGINEER,
COMPLIANCE_REVIEWER, AUDITOR, CLIENT_VIEWER.

See `supabase/migrations/0003_rls_helpers_and_catalogue.sql` for the exact
role→permission mapping.
