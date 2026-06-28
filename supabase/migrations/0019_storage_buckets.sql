-- ============================================================================
-- Handoff — 0019 Private storage buckets + org-scoped RLS on storage.objects
-- Object path convention: {organization_id}/<entity>/<id>/<filename>
-- The first path segment is the organization id, used for access control.
-- ============================================================================

insert into storage.buckets (id, name, public) values
  ('avatars','avatars',false),
  ('attachments','attachments',false),
  ('documents','documents',false)
on conflict (id) do nothing;

-- Helper: is the first folder segment of an object path an org the user is in?
create or replace function handoff.storage_org_ok(p_name text)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select handoff.is_org_member(((storage.foldername(p_name))[1])::uuid);
$$;

do $$
declare op text;
begin
  -- Drop our policies if re-running.
  for op in select polname from pg_policy p
            join pg_class c on c.oid = p.polrelid
            where c.relname = 'objects' and p.polname like 'handoff_%'
  loop
    execute format('drop policy if exists %I on storage.objects;', op);
  end loop;
end $$;

create policy handoff_storage_select on storage.objects for select
  using (bucket_id in ('avatars','attachments','documents') and handoff.storage_org_ok(name));

create policy handoff_storage_insert on storage.objects for insert
  with check (bucket_id in ('avatars','attachments','documents') and handoff.storage_org_ok(name));

create policy handoff_storage_update on storage.objects for update
  using (bucket_id in ('avatars','attachments','documents') and handoff.storage_org_ok(name))
  with check (bucket_id in ('avatars','attachments','documents') and handoff.storage_org_ok(name));

create policy handoff_storage_delete on storage.objects for delete
  using (bucket_id in ('avatars','attachments','documents') and handoff.storage_org_ok(name));
