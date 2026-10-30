-- ============================================================================
-- Grant TRAINEE the AI baseline (ai:use) plus a feature permission
-- (career:view), unblocking the 'my-learning' intent (Career AI). Confirmed
-- gap: migration 0078 granted TRAINEE only organization:view/member:view —
-- every AI intent requires ai:use as a baseline
-- (lib/ai/ai-permission-checks.ts's checkIntentPermissions calls
-- requirePermission(m, 'ai:use') unconditionally), so Career AI was
-- impossible regardless of application code.
--
-- career:view is a new permission code — no existing code fit a trainee's
-- own "view my career/learning data" concept; every training-domain
-- permission added by 0080 is a staff-facing *:manage code, not a
-- trainee-self-service *:view one.
-- ============================================================================

insert into public.permissions (code, description) values
  ('career:view', 'View own career/learning AI insights')
on conflict (code) do nothing;

do $$
declare
  r record;
begin
  for r in select id from public.roles where code = 'TRAINEE' and organization_id is null loop
    insert into public.role_permissions (role_id, permission_code)
    select r.id, code from (values ('ai:use'), ('career:view')) as p(code)
    on conflict do nothing;
  end loop;
end $$;
