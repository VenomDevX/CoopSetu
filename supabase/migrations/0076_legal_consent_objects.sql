-- ============================================================================
-- CoopSetu — 0076 Legal consent objects (reconcile untracked schema drift)
-- ============================================================================
-- These objects exist in the deployed database but NO migration ever created
-- them — they were applied out-of-band. `db-schema.sql` (a pg_dump of the real
-- database) is the only place their DDL was recorded, and this migration is
-- transcribed from it verbatim.
--
-- Why it matters: `lib/legal/get-legal-status.ts` THROWS when the query fails,
-- and it guards `app/invite/[token]/page.tsx`, `GET /api/v1/legal/status` and
-- `POST /api/v1/legal/accept`. A database provisioned purely from migrations
-- (`supabase db reset`, CI, a new environment) had none of these objects, so
-- the invite flow and every legal endpoint errored.
--
-- Every statement is idempotent and guarded, so this is a NO-OP against the
-- deployed database where the objects already exist, and creative everywhere
-- else. That is deliberate: it reconciles the two without dropping anything.
--
-- NOT included here: student_team_join_codes / student_team_settings /
-- student_team_member_labels. They are the same kind of drift, but the student
-- workspace feature was removed (see docs/COOPSETU.md §10) and no live code
-- references them, so they are intentionally left uncreated.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Enum: legal_document_type  (CREATE TYPE has no IF NOT EXISTS)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'legal_document_type'
  ) then
    create type public.legal_document_type as enum ('TERMS', 'PRIVACY', 'COOKIES');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.legal_documents (
  id            uuid default gen_random_uuid() not null,
  document_type public.legal_document_type     not null,
  version       text                           not null,
  title         text                           not null,
  content_hash  text                           not null,
  effective_at  timestamp with time zone,
  created_at    timestamp with time zone default now() not null,
  published_at  timestamp with time zone,
  is_active     boolean default false          not null,
  constraint check_active_is_published
    check (not ((is_active = true) and (published_at is null)))
);

create table if not exists public.user_legal_acceptances (
  id                   uuid default gen_random_uuid() not null,
  user_id              uuid not null,
  terms_document_id    uuid not null,
  privacy_document_id  uuid not null,
  cookies_document_id  uuid,
  accepted_terms_at    timestamp with time zone default now() not null,
  accepted_privacy_at  timestamp with time zone default now() not null,
  accepted_cookies_at  timestamp with time zone,
  acceptance_source    text not null,
  request_id           text not null,
  ip_hash              text,
  user_agent_hash      text,
  created_at           timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------------
-- 3. Primary keys and foreign keys (named to match the deployed database)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'legal_documents_pkey') then
    alter table only public.legal_documents
      add constraint legal_documents_pkey primary key (id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_legal_acceptances_pkey') then
    alter table only public.user_legal_acceptances
      add constraint user_legal_acceptances_pkey primary key (id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_legal_acceptances_user_id_fkey') then
    alter table only public.user_legal_acceptances
      add constraint user_legal_acceptances_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_legal_acceptances_terms_document_id_fkey') then
    alter table only public.user_legal_acceptances
      add constraint user_legal_acceptances_terms_document_id_fkey
      foreign key (terms_document_id) references public.legal_documents(id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_legal_acceptances_privacy_document_id_fkey') then
    alter table only public.user_legal_acceptances
      add constraint user_legal_acceptances_privacy_document_id_fkey
      foreign key (privacy_document_id) references public.legal_documents(id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_legal_acceptances_cookies_document_id_fkey') then
    alter table only public.user_legal_acceptances
      add constraint user_legal_acceptances_cookies_document_id_fkey
      foreign key (cookies_document_id) references public.legal_documents(id) on delete restrict;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Indexes
--    idx_legal_docs_active_type enforces "at most one active doc per type".
-- ---------------------------------------------------------------------------
create unique index if not exists idx_legal_docs_active_type
  on public.legal_documents using btree (document_type) where (is_active = true);

create index if not exists idx_user_legal_acceptances_user_id
  on public.user_legal_acceptances using btree (user_id);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
--    Active published documents are world-readable (the consent gate must be
--    renderable pre-acceptance); acceptances are readable only by their owner.
--    No INSERT/UPDATE/DELETE policy exists by design — writes go exclusively
--    through record_legal_acceptance() below.
-- ---------------------------------------------------------------------------
alter table public.legal_documents         enable row level security;
alter table public.user_legal_acceptances  enable row level security;

drop policy if exists "Public can view active legal documents" on public.legal_documents;
create policy "Public can view active legal documents"
  on public.legal_documents for select
  using ((is_active = true) and (published_at is not null));

drop policy if exists "Users can view their own legal acceptances" on public.user_legal_acceptances;
create policy "Users can view their own legal acceptances"
  on public.user_legal_acceptances for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. record_legal_acceptance() — called via supabase.rpc() from
--    app/api/v1/legal/accept/route.ts. Re-verifies each document id is still
--    the active, published version of the correct type, so a stale or
--    superseded id cannot be accepted.
-- ---------------------------------------------------------------------------
create or replace function public.record_legal_acceptance(
  p_terms_document_id   uuid,
  p_privacy_document_id uuid,
  p_cookies_document_id uuid,
  p_acceptance_source   text,
  p_request_id          text,
  p_ip_hash             text,
  p_user_agent_hash     text
) returns public.user_legal_acceptances
  language plpgsql
  security definer
  set search_path to 'public'
  as $$
DECLARE
  v_row public.user_legal_acceptances;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Re-verify both documents are the currently active, published version of
  -- the correct type. This blocks acceptance against a stale/superseded id.
  IF NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_terms_document_id AND document_type = 'TERMS'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Terms document is not the active version';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_privacy_document_id AND document_type = 'PRIVACY'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Privacy document is not the active version';
  END IF;

  IF p_cookies_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.legal_documents
    WHERE id = p_cookies_document_id AND document_type = 'COOKIES'
      AND is_active = true AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cookies document is not the active version';
  END IF;

  INSERT INTO public.user_legal_acceptances (
    user_id, terms_document_id, privacy_document_id, cookies_document_id,
    accepted_terms_at, accepted_privacy_at, accepted_cookies_at,
    acceptance_source, request_id, ip_hash, user_agent_hash
  ) VALUES (
    auth.uid(), p_terms_document_id, p_privacy_document_id, p_cookies_document_id,
    now(), now(), CASE WHEN p_cookies_document_id IS NOT NULL THEN now() ELSE NULL END,
    p_acceptance_source, p_request_id, p_ip_hash, p_user_agent_hash
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
--    Table grants mirror the deployed database (Supabase's default pattern —
--    RLS above is what actually constrains access).
--    The SECURITY DEFINER function is revoked from PUBLIC and anon, matching
--    the hardening convention established in 0068/0077.
-- ---------------------------------------------------------------------------
grant all on table public.legal_documents        to anon, authenticated, service_role;
grant all on table public.user_legal_acceptances to anon, authenticated, service_role;

revoke all on function public.record_legal_acceptance(uuid, uuid, uuid, text, text, text, text) from public;
revoke all on function public.record_legal_acceptance(uuid, uuid, uuid, text, text, text, text) from anon;
grant execute on function public.record_legal_acceptance(uuid, uuid, uuid, text, text, text, text) to authenticated, service_role;

commit;
