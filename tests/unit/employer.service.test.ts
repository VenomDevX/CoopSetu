import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmployerService, JobService } from '@/services/employer.service';
import type { SupabaseClient } from '@supabase/supabase-js';

const ORG = '00000000-0000-0000-0000-0000000000a0';

function chainBuilder(terminal: () => Promise<{ data: any; error: any }>) {
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: () => terminal(),
    then: (resolve: any) => terminal().then(resolve),
  };
  return builder;
}

describe('EmployerService', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listEmployers() returns employers scoped to the constructor org', async () => {
    const rows = [{ id: 'e1', company_name: 'Acme Co', organization_id: ORG }];
    mockSupabase = { from: vi.fn(() => chainBuilder(() => Promise.resolve({ data: rows, error: null }))) } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    const result = await svc.listEmployers();

    expect(mockSupabase.from).toHaveBeenCalledWith('employers');
    expect(result).toEqual(rows);
  });

  it('listEmployers() throws on a query error', async () => {
    mockSupabase = { from: vi.fn(() => chainBuilder(() => Promise.resolve({ data: null, error: new Error('boom') }))) } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    await expect(svc.listEmployers()).rejects.toThrow('boom');
  });

  it('createEmployer() inserts with the constructor org attached', async () => {
    const created = { id: 'e2', company_name: 'New Co', organization_id: ORG, user_id: 'u1' };
    let insertedPayload: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          insert: vi.fn((payload: any) => { insertedPayload = payload; return builder; }),
          select: vi.fn(() => builder),
          single: () => Promise.resolve({ data: created, error: null }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    const result = await svc.createEmployer({ user_id: 'u1', company_name: 'New Co' });

    expect(insertedPayload).toMatchObject({ user_id: 'u1', company_name: 'New Co', organization_id: ORG });
    expect(result).toEqual(created);
  });

  it('createEmployer() throws on a query error (e.g. RLS rejection)', async () => {
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: () => Promise.resolve({ data: null, error: new Error('new row violates row-level security policy') }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    await expect(svc.createEmployer({ user_id: 'u1', company_name: 'New Co' }))
      .rejects.toThrow('row-level security');
  });

  it('updateEmployer() updates the row by id and stamps updated_at', async () => {
    const updated = { id: 'e1', company_name: 'Renamed Co' };
    let updatedPayload: any;
    let filteredId: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          update: vi.fn((payload: any) => { updatedPayload = payload; return builder; }),
          eq: vi.fn((_col: string, val: any) => { filteredId = val; return builder; }),
          select: vi.fn(() => builder),
          single: () => Promise.resolve({ data: updated, error: null }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new EmployerService(mockSupabase, ORG);
    const result = await svc.updateEmployer('e1', { company_name: 'Renamed Co' });

    expect(filteredId).toBe('e1');
    expect(updatedPayload.company_name).toBe('Renamed Co');
    expect(updatedPayload.updated_at).toBeTruthy();
    expect(result).toEqual(updated);
  });
});

describe('JobService', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateJob() updates the row by id and stamps updated_at', async () => {
    const updated = { id: 'j1', status: 'CLOSED' };
    let updatedPayload: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          update: vi.fn((payload: any) => { updatedPayload = payload; return builder; }),
          eq: vi.fn(() => builder),
          select: vi.fn(() => builder),
          single: () => Promise.resolve({ data: updated, error: null }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new JobService(mockSupabase);
    const result = await svc.updateJob('j1', { status: 'CLOSED' });

    expect(updatedPayload.status).toBe('CLOSED');
    expect(updatedPayload.updated_at).toBeTruthy();
    expect(result).toEqual(updated);
  });

  it('applyToJob() inserts a job_applications row with the given job/trainee ids', async () => {
    const application = { id: 'app1', job_id: 'j1', trainee_id: 't1', status: 'APPLIED' };
    let insertedPayload: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          insert: vi.fn((payload: any) => { insertedPayload = payload; return builder; }),
          select: vi.fn(() => builder),
          single: () => Promise.resolve({ data: application, error: null }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new JobService(mockSupabase);
    const result = await svc.applyToJob({ job_id: 'j1', trainee_id: 't1' });

    expect(insertedPayload).toMatchObject({ job_id: 'j1', trainee_id: 't1' });
    expect(result).toEqual(application);
  });

  it('applyToJob() throws on a duplicate application (unique constraint)', async () => {
    mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: () => Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const svc = new JobService(mockSupabase);
    await expect(svc.applyToJob({ job_id: 'j1', trainee_id: 't1' })).rejects.toBeTruthy();
  });

  it('getApplications() lists applications for a job ordered by match_score', async () => {
    const rows = [{ id: 'app1', job_id: 'j1', match_score: 90 }];
    let filteredJobId: any, orderedBy: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn((_col: string, val: any) => { filteredJobId = val; return builder; }),
          order: vi.fn((col: string) => { orderedBy = col; return Promise.resolve({ data: rows, error: null }); }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new JobService(mockSupabase);
    const result = await svc.getApplications('j1');

    expect(filteredJobId).toBe('j1');
    expect(orderedBy).toBe('match_score');
    expect(result).toEqual(rows);
  });

  it('updateApplicationStatus() updates status and stamps updated_at', async () => {
    const updated = { id: 'app1', status: 'SHORTLISTED' };
    let updatedPayload: any;
    mockSupabase = {
      from: vi.fn(() => {
        const builder: any = {
          update: vi.fn((payload: any) => { updatedPayload = payload; return builder; }),
          eq: vi.fn(() => builder),
          select: vi.fn(() => builder),
          single: () => Promise.resolve({ data: updated, error: null }),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    const svc = new JobService(mockSupabase);
    const result = await svc.updateApplicationStatus('app1', 'SHORTLISTED');

    expect(updatedPayload.status).toBe('SHORTLISTED');
    expect(updatedPayload.updated_at).toBeTruthy();
    expect(result).toEqual(updated);
  });
});
