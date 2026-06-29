import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createProjectDeadline } from '@/services/deadline.service';
import { previewProjectImport, confirmProjectImport } from '@/services/project-import.service';
import { exportProjectsCsv, exportSprintsCsv } from '@/services/report-export.service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? (() => { throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'); })();
const ORG = '00000000-0000-0000-0000-0000000000a0';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? (() => { throw new Error('TEST_USER_PASSWORD is required'); })();

async function asUser(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

async function memberId(c: SupabaseClient) {
  const user = (await c.auth.getUser()).data.user;
  if (!user) throw new Error('missing user');
  const { data, error } = await c
    .from('organization_members')
    .select('id')
    .eq('organization_id', ORG)
    .eq('user_id', user.id)
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

let pm: SupabaseClient;
let dev: SupabaseClient;
let owner: SupabaseClient;
let pmMember: string;
let projectId: string;

beforeAll(async () => {
  pm = await asUser('pm@apexfintech.test');
  dev = await asUser('dev@apexfintech.test');
  owner = await asUser('owner@apexfintech.test');
  pmMember = await memberId(pm);
  const { data, error } = await pm.from('projects').select('id').eq('code', 'UPI').single();
  if (error) throw new Error(error.message);
  projectId = data.id as string;
}, 30000);

describe('Group A action persistence and RLS', () => {
  it('creates a real deadline and writes an audit log through the service', async () => {
    const deadline = await createProjectDeadline(pm, ORG, pmMember, {
      project_id: projectId,
      title: `Integration deadline ${Date.now()}`,
      due_date: '2026-12-31',
    });

    expect(deadline.id).toBeTruthy();
    const { data: readBack } = await pm
      .from('project_deadlines')
      .select('id, title, organization_id, project_id')
      .eq('id', deadline.id)
      .single();
    expect(readBack).toMatchObject({ id: deadline.id, organization_id: ORG, project_id: projectId });

    const { data: audit } = await owner
      .from('audit_logs')
      .select('id, action, resource_id')
      .eq('action', 'deadline.created')
      .eq('resource_id', deadline.id)
      .maybeSingle();
    expect(audit?.resource_id).toBe(deadline.id);
  });

  it('blocks deadlines for missing or foreign projects', async () => {
    const { error } = await pm.from('project_deadlines').insert({
      organization_id: ORG,
      project_id: '00000000-0000-0000-0000-00000000dead',
      title: 'Invalid project deadline',
      due_date: '2026-12-31',
      created_by_member_id: pmMember,
    });
    expect(error).toBeTruthy();
  });

  it('only authorized roles can create project import jobs', async () => {
    const { error: devError } = await dev.from('import_jobs').insert({
      organization_id: ORG,
      created_by_member_id: await memberId(dev),
      import_type: 'PROJECTS',
      file_name: 'denied.csv',
      mime_type: 'text/csv',
      size_bytes: 12,
    });
    expect(devError).toBeTruthy();

    const { error: pmError } = await pm.from('import_jobs').insert({
      organization_id: ORG,
      created_by_member_id: pmMember,
      import_type: 'PROJECTS',
      file_name: 'allowed.csv',
      mime_type: 'text/csv',
      size_bytes: 12,
    });
    expect(pmError).toBeNull();
  });

  it('only authorized roles can create report export records', async () => {
    const { error: devError } = await dev.from('report_exports').insert({
      organization_id: ORG,
      actor_member_id: await memberId(dev),
      export_type: 'PROJECT_REPORT',
      format: 'CSV',
      file_name: 'denied.csv',
      row_count: 0,
    });
    expect(devError).toBeTruthy();

    const { error: pmError } = await pm.from('report_exports').insert({
      organization_id: ORG,
      actor_member_id: pmMember,
      export_type: 'PROJECT_REPORT',
      format: 'CSV',
      file_name: 'allowed.csv',
      row_count: 0,
    });
    expect(pmError).toBeNull();
  });

  it('previews and confirms project CSV imports through the service', async () => {
    const code = `GA${Date.now().toString().slice(-10)}`;
    const file = new File(
      [`name,code,priority,status\nGroup A Import ${code},${code},HIGH,PLANNING\n`],
      `projects-${code}.csv`,
      { type: 'text/csv' },
    );

    const preview = await previewProjectImport(pm, ORG, pmMember, file);
    expect(preview.summary).toMatchObject({ valid: 1, invalid: 0, total: 1 });

    const confirmed = await confirmProjectImport(pm, ORG, pmMember, preview.importId, preview.mapping);
    expect(confirmed.summary).toMatchObject({ created: 1, skipped: 0, failed: 0, total: 1 });

    const { data: created, error } = await pm
      .from('projects')
      .select('id, code, name')
      .eq('organization_id', ORG)
      .eq('code', code)
      .single();
    expect(error).toBeNull();
    expect(created?.name).toBe(`Group A Import ${code}`);

    const { data: audit } = await owner
      .from('audit_logs')
      .select('id, action, resource_id')
      .eq('action', 'project.imported')
      .eq('resource_id', preview.importId)
      .maybeSingle();
    expect(audit?.resource_id).toBe(preview.importId);
  });

  it('records project and sprint exports through the service', async () => {
    const projectExport = await exportProjectsCsv(pm, ORG, pmMember, { q: 'UPI' });
    expect(projectExport.fileName).toMatch(/project-report/);
    expect(projectExport.csv).toContain('code,name,status');

    const sprintExport = await exportSprintsCsv(pm, ORG, pmMember, { status: 'ALL' });
    expect(sprintExport.fileName).toMatch(/sprint-report/);
    expect(sprintExport.csv).toContain('sprint_name');

    const { data: exports, error } = await pm
      .from('report_exports')
      .select('export_type, file_name, row_count')
      .in('file_name', [projectExport.fileName, sprintExport.fileName])
      .order('created_at', { ascending: false });
    expect(error).toBeNull();
    expect(exports?.map((row) => row.export_type).sort()).toEqual(['PROJECT_REPORT', 'SPRINT_REPORT']);
  });
});
