-- ============================================================================
-- Handoff — 0010 Comments, mentions, attachments, notifications, presence
-- ============================================================================

create table if not exists public.task_comments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  task_id           uuid not null references public.tasks(id) on delete cascade,
  author_member_id  uuid not null references public.organization_members(id) on delete cascade,
  body              text not null,
  edited_at         timestamptz,
  deleted_at        timestamptz,
  parent_comment_id uuid references public.task_comments(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select handoff.attach_updated_at('public.task_comments');
create index if not exists task_comments_task_idx on public.task_comments(task_id, created_at);

create table if not exists public.comment_mentions (
  comment_id          uuid not null references public.task_comments(id) on delete cascade,
  mentioned_member_id uuid not null references public.organization_members(id) on delete cascade,
  primary key (comment_id, mentioned_member_id)
);

create table if not exists public.attachments (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  uploaded_by_member_id  uuid references public.organization_members(id) on delete set null,
  project_id             uuid references public.projects(id) on delete cascade,
  task_id                uuid references public.tasks(id) on delete cascade,
  document_id            uuid,
  release_id             uuid,
  incident_id            uuid,
  bucket                 text not null default 'attachments',
  storage_path           text not null,
  file_name              text not null,
  mime_type              text,
  size_bytes             bigint,
  classification         text not null default 'INTERNAL'
    check (classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  created_at             timestamptz not null default now()
);
create index if not exists attachments_task_idx on public.attachments(task_id);
create index if not exists attachments_project_idx on public.attachments(project_id);

create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  recipient_member_id uuid not null references public.organization_members(id) on delete cascade,
  actor_member_id     uuid references public.organization_members(id) on delete set null,
  type                text not null,
  title               text not null,
  body                text,
  entity_type         text,
  entity_id           uuid,
  project_id          uuid references public.projects(id) on delete cascade,
  read_at             timestamptz,
  archived_at         timestamptz,
  snoozed_until       timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_member_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_member_id) where read_at is null;

create table if not exists public.notification_preferences (
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  notification_type      text not null,
  in_app_enabled         boolean not null default true,
  email_enabled          boolean not null default false,
  push_enabled           boolean not null default false,
  primary key (organization_member_id, notification_type)
);

create table if not exists public.presence_sessions (
  id                     uuid primary key default gen_random_uuid(),
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  channel                text not null,
  last_seen_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Notification helper (SECURITY DEFINER): write a notification for a recipient.
-- ----------------------------------------------------------------------------
create or replace function public.create_notification(
  p_org uuid, p_recipient uuid, p_type text, p_title text,
  p_body text default null, p_entity_type text default null,
  p_entity_id uuid default null, p_project_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_id uuid;
begin
  select id into v_actor from public.organization_members
   where organization_id = p_org and user_id = auth.uid() and is_active limit 1;
  -- don't notify yourself
  if v_actor is not null and v_actor = p_recipient then
    return null;
  end if;
  insert into public.notifications (organization_id, recipient_member_id, actor_member_id,
    type, title, body, entity_type, entity_id, project_id, metadata)
  values (p_org, p_recipient, v_actor, p_type, p_title, p_body, p_entity_type, p_entity_id, p_project_id, coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_notification(uuid,uuid,text,text,text,text,uuid,uuid,jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: notify a member when they are added as a task assignee.
-- ----------------------------------------------------------------------------
create or replace function handoff.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_task record;
begin
  select t.organization_id, t.project_id, t.title, t.task_key
    into v_task from public.tasks t where t.id = new.task_id;
  perform public.create_notification(
    v_task.organization_id, new.organization_member_id, 'TASK_ASSIGNED',
    'You were assigned to ' || coalesce(v_task.task_key,'a task'),
    v_task.title, 'task', new.task_id, v_task.project_id, '{}'::jsonb);
  return new;
end;
$$;
drop trigger if exists trg_notify_task_assigned on public.task_assignees;
create trigger trg_notify_task_assigned after insert on public.task_assignees
  for each row execute function handoff.notify_task_assigned();

-- ----------------------------------------------------------------------------
-- Trigger: log task changes to task_activity automatically (status/assignee).
-- ----------------------------------------------------------------------------
create or replace function handoff.log_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
begin
  select id into v_actor from public.organization_members
   where organization_id = new.organization_id and user_id = auth.uid() and is_active limit 1;
  if new.status is distinct from old.status then
    insert into public.task_activity(task_id, actor_member_id, activity_type, old_value, new_value)
    values (new.id, v_actor, 'status_changed', to_jsonb(old.status), to_jsonb(new.status));
  end if;
  if new.primary_assignee_member_id is distinct from old.primary_assignee_member_id then
    insert into public.task_activity(task_id, actor_member_id, activity_type, old_value, new_value)
    values (new.id, v_actor, 'assignee_changed',
      to_jsonb(old.primary_assignee_member_id), to_jsonb(new.primary_assignee_member_id));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_log_task_change on public.tasks;
create trigger trg_log_task_change after update on public.tasks
  for each row execute function handoff.log_task_change();

-- ---------------------------------------------------------------- RLS --------
alter table public.task_comments           enable row level security;
alter table public.comment_mentions        enable row level security;
alter table public.attachments             enable row level security;
alter table public.notifications           enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.presence_sessions       enable row level security;

create policy comments_select on public.task_comments for select
  using (handoff.can_view_project(handoff.task_project(task_id)));
create policy comments_insert on public.task_comments for insert
  with check (
    handoff.can_view_project(handoff.task_project(task_id))
    and exists (select 1 from public.organization_members m
                where m.id = author_member_id and m.user_id = auth.uid())
  );
create policy comments_update_own on public.task_comments for update
  using (exists (select 1 from public.organization_members m
                 where m.id = author_member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m
                 where m.id = author_member_id and m.user_id = auth.uid()));

create policy mentions_select on public.comment_mentions for select
  using (exists (select 1 from public.task_comments c where c.id = comment_id
    and handoff.can_view_project(handoff.task_project(c.task_id))));
create policy mentions_insert on public.comment_mentions for insert
  with check (exists (select 1 from public.task_comments c
    join public.organization_members m on m.id = c.author_member_id
    where c.id = comment_id and m.user_id = auth.uid()));

create policy attachments_select on public.attachments for select
  using (handoff.is_org_member(organization_id)
    and (task_id is null or handoff.can_view_project(handoff.task_project(task_id)))
    and (project_id is null or handoff.can_view_project(project_id)));
create policy attachments_insert on public.attachments for insert
  with check (handoff.is_org_member(organization_id)
    and exists (select 1 from public.organization_members m
                where m.id = uploaded_by_member_id and m.user_id = auth.uid()));
create policy attachments_delete on public.attachments for delete
  using (exists (select 1 from public.organization_members m
                 where m.id = uploaded_by_member_id and m.user_id = auth.uid())
    or (task_id is not null and handoff.can_manage_project(handoff.task_project(task_id))));

-- recipients see only their own notifications
create policy notifications_select on public.notifications for select
  using (exists (select 1 from public.organization_members m
                 where m.id = recipient_member_id and m.user_id = auth.uid()));
create policy notifications_update_own on public.notifications for update
  using (exists (select 1 from public.organization_members m
                 where m.id = recipient_member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m
                 where m.id = recipient_member_id and m.user_id = auth.uid()));
-- inserts go through create_notification (SECURITY DEFINER); no insert policy

create policy notif_prefs_all on public.notification_preferences for all
  using (exists (select 1 from public.organization_members m
                 where m.id = organization_member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m
                 where m.id = organization_member_id and m.user_id = auth.uid()));

create policy presence_select on public.presence_sessions for select
  using (exists (select 1 from public.organization_members m
                 where m.id = organization_member_id and handoff.is_org_member(m.organization_id)));
create policy presence_all on public.presence_sessions for all
  using (exists (select 1 from public.organization_members m
                 where m.id = organization_member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m
                 where m.id = organization_member_id and m.user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Realtime: publish the collaboration tables so clients receive change events.
-- (RLS is still enforced for realtime via the authenticated token.)
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_assignees;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.task_activity;
