# Handoff — Realtime

Realtime is powered by Supabase `postgres_changes` over the tables added to the
`supabase_realtime` publication (see `0010_collab_notifications.sql`):
`tasks`, `task_assignees`, `task_comments`, `notifications`, `task_activity`.

RLS still applies to realtime: a client only receives change events for rows it
is allowed to read, because the realtime connection uses the user's auth token.

## Channels (`lib/realtime/channels.ts`)

- `organization:{orgId}`
- `project:{projectId}` — board updates
- `task:{taskId}` — comments / activity / presence
- `user:{memberId}` / `notifications:{memberId}` — inbox

## Hooks (`hooks/`)

- `useBoardRealtime(projectId, onChange)` — refetch board on task/assignee change
- `useTaskRealtime(taskId, onChange)` — live comments/activity in the drawer
- `useNotificationsRealtime(memberId, onChange)` — live inbox/bell
- `usePresence(channel, self)` — who's viewing a task/project (avatars)

To avoid double updates, mutations are optimistic locally and reconciled by a
realtime-triggered refetch.

## Verifying realtime

### Automated (headless)
```bash
node scripts/verify-realtime.mjs
```
Signs in as PM + Developer, subscribes the Developer to a project channel, has
the PM insert a task, and asserts the Developer receives the live event.

### Manual (two browser sessions)
1. `npm run dev`
2. Window A: sign in as `pm@apexfintech.test`. Window B (incognito): sign in as
   `dev@apexfintech.test`. Open **Tasks** in both.
3. In A: create a task / drag a card to a new column / open a card and comment.
4. In B: the card appears / moves / the comment shows — **without refreshing**.
   The Developer's notification bell increments live when assigned or mentioned.
