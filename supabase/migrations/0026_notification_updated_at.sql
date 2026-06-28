-- ============================================================================
-- Handoff — 0026 Add updated_at to notifications
-- ============================================================================

alter table public.notifications 
add column if not exists updated_at timestamptz not null default now();

select handoff.attach_updated_at('public.notifications');
