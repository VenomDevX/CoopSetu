-- Handoff — 0027 Storage Security (MIME type restrictions)

-- Drop existing policies that we are going to replace
drop policy if exists handoff_storage_insert on storage.objects;
drop policy if exists handoff_storage_update on storage.objects;

-- Recreate with strict MIME type checks for attachments and documents
create policy handoff_storage_insert on storage.objects for insert
  with check (
    bucket_id in ('avatars','attachments','documents') 
    and handoff.storage_org_ok(name)
    and (
      bucket_id = 'avatars' or
      (metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/csv', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
    )
  );

create policy handoff_storage_update on storage.objects for update
  using (
    bucket_id in ('avatars','attachments','documents') 
    and handoff.storage_org_ok(name)
  )
  with check (
    bucket_id in ('avatars','attachments','documents') 
    and handoff.storage_org_ok(name)
    and (
      bucket_id = 'avatars' or
      (metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/csv', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
    )
  );
