// Headless two-session realtime verification.
// Usage: node scripts/verify-realtime.mjs   (local Supabase must be running)
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const mk = () => createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 10 } } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dev = mk(), pm = mk();
await pm.auth.signInWithPassword({ email: 'pm@apexfintech.test', password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });
await dev.auth.signInWithPassword({ email: 'dev@apexfintech.test', password: process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })() });

const { data: proj } = await pm.from('projects').select('id,code').limit(1).single();
let received = null;
const ch = dev.channel('project:' + proj.id)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'tasks', filter: 'project_id=eq.' + proj.id },
    (p) => { received = p.new; })
  .subscribe((s) => console.log('dev subscription:', s));

await wait(2500);
const { data: task, error } = await pm.from('tasks')
  .insert({ organization_id: ORG, project_id: proj.id, title: 'realtime check', status: 'BACKLOG' })
  .select().single();
if (error) { console.error('insert failed:', error.message); process.exit(1); }
console.log('PM inserted', task.task_key);

await wait(3000);
const taskPass = !!received;
console.log(taskPass ? `PASS: dev received live event for ${received.task_key}` : 'FAIL: no task event received');

// --- Notifications realtime: drives Inbox counts, unread badge, My Work. -----
// dev subscribes to their own notifications; pm creates one → dev sees it live.
const { data: devUser } = await dev.auth.getUser();
const { data: devMember } = await pm.from('organization_members')
  .select('id').eq('organization_id', ORG).eq('user_id', devUser.user.id).single();

let notif = null;
const nch = dev.channel('notifications:' + devMember.id)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'recipient_member_id=eq.' + devMember.id },
    (p) => { notif = p.new; })
  .subscribe((s) => console.log('dev notif subscription:', s));

await wait(2500);
await pm.rpc('create_notification', {
  p_org: ORG, p_recipient: devMember.id, p_type: 'TASK_MENTIONED',
  p_title: 'realtime notif check', p_body: 'x', p_entity_type: 'task',
  p_entity_id: null, p_project_id: null, p_metadata: {},
});

await wait(3000);
const notifPass = !!notif;
console.log(notifPass ? 'PASS: dev received live notification event' : 'FAIL: no notification event received');

process.exit(taskPass && notifPass ? 0 : 1);
